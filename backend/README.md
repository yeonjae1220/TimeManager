# TimeManager Backend

계층형 태그 기반의 시간 추적 REST API 서버입니다. 사용자가 태그(작업)를 트리 구조로 관리하고, 스톱워치로 시간을 기록하며, 기록된 시간을 상위 태그까지 자동 집계합니다.

## Tech Stack

| 구분 | 기술 |
|------|------|
| Framework | Spring Boot 3.4.2 |
| Language | Java 17 |
| Build Tool | Gradle |
| ORM | Spring Data JPA + QueryDSL 5.0.0 |
| Database | H2 |
| Utilities | Lombok, P6Spy |
| Testing | JUnit 5 |

## Project Structure

헥사고날 아키텍처(Ports & Adapters)로 구성되어 있습니다.

```
src/main/java/project/TimeManager/
├── domain/                          # 순수 Java 도메인 모델 (프레임워크 의존성 없음)
│   ├── member/model/
│   ├── tag/model/                   # Tag, TagType, TimerState
│   └── record/model/                # Record, TimeRange (값 객체)
├── application/                     # 유스케이스 & 포트
│   ├── port/in/                     # Inbound 포트 (UseCase/Query 인터페이스)
│   ├── port/out/                    # Outbound 포트 (인프라 인터페이스)
│   ├── service/command/             # 쓰기 서비스 (@Transactional)
│   ├── service/query/               # 읽기 서비스 (readOnly=true)
│   └── dto/                         # Command 객체 & Result 객체
└── adapter/
    ├── in/web/                      # REST 컨트롤러 + Request/Response DTO
    └── out/persistence/             # JPA 엔티티, Repository, PersistenceAdapter
```

## Domain Model

```
Member (1) ──── (*) Tag (self-referencing tree)
                     │
                     └── (*) Records
```

- **Member**: 사용자 계정. 생성 시 ROOT, DISCARDED 기본 태그가 자동 생성됩니다.
- **Tag**: 계층형 작업 태그. 부모-자식 관계로 트리를 구성하며, 스톱워치 상태와 누적 시간을 관리합니다.
- **Records**: 개별 시간 기록. 시작/종료 시각과 소요 시간(초)을 저장합니다.

### Tag 계층 구조

```
ROOT (자동 생성)
├── 공부
│   ├── 수학
│   └── 영어
├── 운동
│   └── 러닝
└── ...

DISCARDED (자동 생성, 휴지통 역할)
```

## API Endpoints

### Tag API (`/api/tag`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/{memberId}` | 회원의 전체 태그 트리 조회 |
| `GET` | `/detail/{tagId}` | 태그 상세 조회 |
| `POST` | `/{tagId}/start` | 스톱워치 시작 |
| `POST` | `/{tagId}/reset` | 스톱워치 초기화 |
| `POST` | `/{tagId}/create` | 하위 태그 생성 |
| `PUT` | `/{tagId}/updateParent` | 태그 이동 (부모 변경 / 삭제) |

### Record API (`/api/record`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| `POST` | `/{tagId}/stop` | 스톱워치 정지 및 기록 저장 |
| `GET` | `/log/{tagId}` | 태그의 시간 기록 목록 조회 |
| `POST` | `/create/{tagId}` | 수동 기록 생성 |
| `PUT` | `/updateTime/{recordId}` | 기록 시간 수정 |
| `DELETE` | `/delete/{recordId}` | 기록 삭제 |

## Key Features

### 스톱워치
- 태그별 스톱워치 시작/정지/초기화
- 사용자당 동시에 하나의 타이머만 실행 (다른 태그 시작 시 기존 타이머 자동 정지)
- 정지 시 자동으로 Records 생성

### 시간 집계
- 기록 생성/수정/삭제 시 해당 태그부터 ROOT까지 누적 시간 자동 갱신
- `tagTotalTime`: 해당 태그 자체의 누적 시간
- `totalTime`: 해당 태그 + 모든 하위 태그의 누적 시간

### 태그 관리
- 무제한 깊이의 계층 구조
- 태그 이동 (부모 변경) 시 시간 집계 자동 재계산
- DISCARDED 태그로 이동하여 소프트 삭제

## Getting Started

### Prerequisites

- Java 17+
- H2 Database 실행

### H2 Database 실행

```bash
# H2 데이터베이스를 TCP 모드로 실행해야 합니다
# 접속 URL: jdbc:h2:tcp://localhost/~/timer
```

### Build & Run

```bash
# 빌드
./gradlew build

# 실행
./gradlew bootRun
```

서버가 시작되면 `local` 프로파일에서 샘플 데이터(회원 2명, 태그, 기록)가 자동 생성됩니다.

### Configuration

`src/main/resources/application.yml`:

```yaml
spring:
  datasource:
    url: jdbc:h2:tcp://localhost/~/timer
    username: sa
  jpa:
    hibernate:
      ddl-auto: create    # 실행 시 스키마 재생성
```

### Test

```bash
./gradlew test
```
