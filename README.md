# TimeManager

계층형 태그 기반 시간 기록 서비스입니다. 사용자는 무제한 깊이의 태그 트리에서 타이머를 실행하고, 기록은 상위 태그까지 함께 집계됩니다. PWA 환경에서 오프라인 작업을 보관하고 연결 복구 후 재전송하도록 설계했습니다.

## Engineering highlights

- **계층 집계** — PostgreSQL 재귀 CTE와 단일 벌크 `UPDATE`로, 상위 태그 갱신을 계층 깊이에 비례한 N회 질의에서 1회로 줄였습니다.
- **다기기 정합성** — JPA 낙관적 잠금으로 동시 수정 충돌을 감지하고, 충돌 시 사용자가 재시도할 수 있도록 처리했습니다.
- **오프라인 작업** — 요청을 로컬에 보관하고 재생 전에 유효성을 다시 확인합니다. 인증 문제(`401`)는 큐를 보존하고, 다른 확정 `4xx`는 큐 정체를 막기 위해 폐기합니다.
- **실시간 상태 보호** — stale cache가 타이머 상태를 되살리지 않도록 초 단위 상태는 서비스 워커 런타임 캐시에서 제외했습니다.

## Stack

Java 17 · Spring Boot · Spring Data JPA · QueryDSL · PostgreSQL · Redis · Next.js · PWA · Docker · Kubernetes · GitHub Actions

## Project structure

```text
backend/   Spring Boot application (Ports & Adapters)
frontend/  Next.js application and PWA shell
k8s/       Kubernetes manifests and network policy
```

## Local development

Use JDK 17 and a Node.js version that meets the lockfile's tooling requirements.
Start Redis in Docker. The local backend uses a fresh in-memory H2 database,
binds to loopback, and disables admin access, Web Push, and remote feedback forwarding.

```bash
docker compose up -d redis

# Backend terminal
export JWT_SECRET="$(openssl rand -base64 32)"
cd backend
./gradlew bootRun

# Frontend terminal
cd frontend
npm ci
npm run dev
```

Open http://localhost:3000 and sign in with the local sample account
`member1@test.com` / `password123` or register a local test account.

Run backend tests with `cd backend && ./gradlew test`.

For implementation notes, measured tradeoffs, and known limits, see the [portfolio](https://portfolio.mungji.com/#p07).

## Deployment verification

The deploy job records the requested and previous backend/frontend image references
in the Actions summary. It runs a manifest diff and deploys the image digests
built by the same workflow run. If a rollout fails, review the rollout diagnostics
and schema compatibility before restoring the previous digest for each app.
The summary also lists immutable image references observed on ready pods, when
the container runtime reports them. Use the last verified digest pair from a
successful deployment. If the previous spec uses `:latest` and the summary has
no ready digest or lists multiple candidates, establish the correct pair before
rolling back.

After confirming that the previous images work with the current schema and
configuration, set `backend_image` and `frontend_image` to those full
`registry/repository@sha256:...` references. To restore the images, run on the
deployment host against its TimeManager cluster:

```bash
sudo kubectl -n timemanager set image deployment/backend "backend=${backend_image:?}"
sudo kubectl -n timemanager rollout status deployment/backend --timeout=300s
sudo kubectl -n timemanager set image deployment/frontend "frontend=${frontend_image:?}"
sudo kubectl -n timemanager rollout status deployment/frontend --timeout=300s
```

Verify the live image references and run login, recording, and stats checks.
This operation restores images only. Changes to the schema, credentials, or
other settings need their own recovery procedure. The next deployment will
select the digests from that workflow run.
