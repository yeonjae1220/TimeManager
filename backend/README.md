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

```
src/main/java/project/TimeManager/
├── entity/                # 도메인 엔티티
│   ├── Member.java        # 사용자
│   ├── Tag.java           # 계층형 태그 (작업 단위)
│   ├── Records.java       # 시간 기록
│   ├── TagType.java       # ROOT / DISCARDED / CUSTOM
│   └── State.java         # RUN / STOP
├── repository/            # 데이터 접근 계층 (JPA + QueryDSL)
├── Service/               # 비즈니스 로직
├── controller/            # REST API 컨트롤러
└── dto/                   # 데이터 전송 객체
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



