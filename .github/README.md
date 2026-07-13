# TimeManager

> 계층형 태그 기반 시간 추적 앱. 스톱워치로 작업 시간을 기록하면 상위 태그까지 자동으로 집계됩니다.

무제한 깊이의 태그 트리를 만들고, 어떤 태그든 스톱워치를 눌러 시간을 기록하면
부모 태그를 거쳐 ROOT까지 누적 시간이 자동으로 갱신됩니다. PWA로 설치해
오프라인에서도 타이머가 동작하며, 재접속 시 백그라운드로 동기화됩니다.

## Tech Stack

| 구분 | 기술 |
|------|------|
| Backend | Java 17 · Spring Boot 3.4.2 |
| Architecture | Hexagonal (Ports & Adapters) |
| ORM | Spring Data JPA · QueryDSL 5 |
| Migration | Flyway |
| Database | PostgreSQL 15 (개발: H2) |
| Cache / Session | Redis 7 (JWT refresh token, SHA-256 해시 저장) |
| Security | Spring Security · JWT (httpOnly 쿠키) · 역할 기반 권한 |
| Push | Web Push (VAPID) |
| Frontend | Next.js 15 · React 19 · PWA · i18n(9개 언어) |
| Observability | logstash JSON 구조화 로그 · access log |
| Deploy | Docker · Kubernetes(k3s) · GitHub Actions CI/CD |

> 프론트엔드는 v0.5.0에서 Vue3 + Vite → Next.js 15 + React 19로 전면 재작성되었습니다.

## Project Structure

```
TimeManager/
├── backend/               ← Spring Boot (헥사고날 아키텍처)
│   └── src/main/java/project/TimeManager/
│       ├── domain/        ← 순수 Java 도메인 모델
│       ├── application/   ← UseCase / Port / Service / DTO
│       └── adapter/       ← REST Controller / JPA Persistence
├── frontend/              ← Next.js 15 + React 19 (App Router, PWA)
├── k8s/                   ← Kubernetes 매니페스트 (network-policy 포함)
└── docker-compose.yml
```

## Domain Model

```
Member (1) ──── (*) Tag (self-referencing tree)
                     │
                     └── (*) Records
```

- **Member** — 사용자 계정. 가입 시 `ROOT`, `DISCARDED` 태그 자동 생성.
- **Tag** — 계층형 작업 태그. 무제한 깊이 트리 구조. 스톱워치 상태와 누적 시간 관리.
- **Record** — 개별 시간 기록 (시작 / 종료 / 소요 시간).

### 태그 예시

```
ROOT
├── 공부
│   ├── 수학
│   └── 영어
└── 운동
    └── 러닝

DISCARDED  ← 소프트 삭제용 휴지통
```

## Key Features

- **인증** — Spring Security + JWT. refresh token은 httpOnly 쿠키(TTL 30일)로 관리하고 Redis에 SHA-256 해시로 저장. 역할 기반(ADMIN/MEMBER) 권한과 Google OAuth 2.0 로그인 지원.
- **스톱워치** — 사용자당 하나의 타이머만 동시 실행. 다른 태그 시작 시 기존 타이머 자동 정지.
- **시간 집계** — 기록 생성·수정·삭제 시 해당 태그부터 ROOT까지 누적 시간 자동 갱신.
- **태그 이동** — 부모 변경 시 집계 자동 재계산. DISCARDED로 이동 시 소프트 삭제.
- **로그 리포트** — 일/주/월 요약 페이지와 하루 타임라인 뷰.
- **타임존** — 사용자별 타임존 및 일일 리셋 시각 설정.
- **다국어 · 관리자** — 9개 언어 i18n UI, SSR 기반 관리자 패널.
- **Web Push · PWA** — VAPID 푸시 알림, 오프라인 우선 캐싱·백그라운드 동기화·Wake Lock·크로스 디바이스 세션 복원.

## Version History

버전별 상세 변경 내역은 [CHANGELOG.md](../CHANGELOG.md)를 참고하세요.

| 버전 | 날짜 | 핵심 변경 |
|------|------|-----------|
| 0.7.0 | 2026-07-13 | 타이머 정확도·유령 러닝 근절 (정지 누적 복원 · reset 권위 상태 · SW 캐싱 제외 · 레이스 화해) · 테마 3-way · 접근성 |
| 0.6.0 | 2026-07-01 | 보안 하드닝 · 구조화 로깅 · 콘솔 집계 · 피드백 수집 |
| 0.5.0 | 2026-06-08 | **Next.js 15 프론트엔드 전면 재작성** · NetworkPolicy · Flyway · 9개국어 |
| 0.4.0 | 2026-05-11 | 관리자 패널 · 역할 기반 JWT · httpOnly 쿠키 인증 |
| 0.3.0 | 2026-04-13 | IDOR 취약점 수정 · 소유권 검증 · 낙관적 락 |
| 0.2.0 | 2026-03-26 | Google OAuth 2.0 로그인 |
| 0.1.0 | 2026-03-17 | 헥사고날 아키텍처 · PWA · 푸시 알림 |

## API Overview

| 그룹 | Base Path | 주요 기능 |
|------|-----------|-----------|
| Auth | `/api/v1/auth` | 로그인 · 로그아웃 · 토큰 갱신 |
| Member | `/api/v1/members` | 회원 가입 |
| Tag | `/api/tag` | 태그 트리 조회 · 스톱워치 · 태그 관리 |
| Record | `/api/record` | 기록 저장 · 조회 · 수정 · 삭제 |
| Push | `/api/push` | 푸시 구독 · 해제 |

## Getting Started

### Prerequisites

- Docker & Docker Compose
- (로컬 개발) Java 17+, Node.js 20+

### 환경 변수 설정

```bash
cp .env.example .env
# 필수: PUSH_VAPID_PUBLIC_KEY, PUSH_VAPID_PRIVATE_KEY, JWT_SECRET
# VAPID 키 생성: npx web-push generate-vapid-keys
```

### Docker로 전체 실행

```bash
docker compose up -d
```

| 서비스 | 주소 |
|--------|------|
| Frontend | http://localhost:80 |
| Backend API | http://localhost:8081 |

### 로컬 개발

```bash
# 백엔드 (H2 인메모리 DB 자동 사용)
cd backend && ./gradlew bootRun

# 프론트엔드
cd frontend && npm install && npm run dev
```

### 테스트

```bash
cd backend && ./gradlew test
```
