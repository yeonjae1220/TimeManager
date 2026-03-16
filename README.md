# TimeManager

계층형 태그 기반 시간 추적 앱. 스톱워치로 작업 시간을 기록하고, 상위 태그까지 자동 집계합니다.

## Tech Stack

| 구분 | 기술 |
|------|------|
| Backend Language | Java 17 |
| Backend Framework | Spring Boot 3.4.2 |
| ORM | Spring Data JPA + QueryDSL 5 |
| Database | PostgreSQL 15 (개발: H2) |
| Cache / Session | Redis 7 (JWT) |
| Security | Spring Security + JWT |
| Push | Web Push (VAPID) |
| Frontend | Vue.js 3 |
| Deploy | Docker Compose |

## Project Structure

```
TimeManager/
├── backend/               ← Spring Boot (헥사고날 아키텍처)
│   └── src/main/java/project/TimeManager/
│       ├── domain/        ← 순수 Java 도메인 모델
│       ├── application/   ← UseCase / Port / Service / DTO
│       └── adapter/       ← REST Controller / JPA Persistence
├── frontend/              ← Vue.js 3 SPA
└── docker-compose.yml     ← 전체 스택 실행
```

## Domain Model

```
Member (1) ──── (*) Tag (self-referencing tree)
                     │
                     └── (*) Records
```

- **Member**: 사용자 계정. 가입 시 `ROOT`, `DISCARDED` 태그가 자동 생성됩니다.
- **Tag**: 계층형 작업 태그. 무제한 깊이의 트리를 구성하며 스톱워치 상태와 누적 시간을 관리합니다.
- **Record**: 개별 시간 기록 (시작 / 종료 / 소요 시간).

### 태그 예시

```
ROOT (자동 생성)
├── 공부
│   ├── 수학
│   └── 영어
└── 운동
    └── 러닝

DISCARDED (소프트 삭제용 휴지통)
```

## Key Features

- **스톱워치**: 사용자당 하나의 타이머만 동시 실행. 다른 태그 시작 시 기존 타이머 자동 정지.
- **시간 집계**: 기록 생성 / 수정 / 삭제 시 해당 태그부터 ROOT까지 누적 시간 자동 갱신.
- **태그 이동**: 부모 변경 시 시간 집계 자동 재계산.
- **Web Push**: VAPID 기반 브라우저 푸시 알림.

## Getting Started

### Prerequisites

- Docker & Docker Compose
- (로컬 개발) Java 17+, Node.js 20+

### 환경 변수 설정

```bash
cp .env.example .env
# PUSH_VAPID_PUBLIC_KEY, PUSH_VAPID_PRIVATE_KEY를 채워주세요
# 키 생성: npx web-push generate-vapid-keys
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

**백엔드**

```bash
cd backend
./gradlew bootRun
# 기본 프로파일: H2 인메모리 DB 사용
```

**프론트엔드**

```bash
cd frontend
npm install
npm run serve
```

### 테스트

```bash
cd backend
./gradlew test
```
