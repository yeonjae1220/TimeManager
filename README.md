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

```bash
cp .env.example .env
docker compose up -d

# Backend
cd backend && ./gradlew bootRun

# Frontend
cd frontend && npm install && npm run dev
```

Run backend tests with `cd backend && ./gradlew test`.

For implementation notes, measured tradeoffs, and known limits, see the [portfolio](https://portfolio.mungji.com/#p07).
