# Changelog

이 프로젝트의 모든 주요 변경 사항을 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)를 따르며,
[유의적 버전(SemVer)](https://semver.org/lang/ko/)을 준수합니다.
0.x 구간이므로 파괴적 변경도 MINOR 버전으로 흡수합니다.

## [Unreleased]

## [0.7.0] - 2026-07-13

타이머 정확도와 유령 러닝 근절에 집중한 릴리스 — 정지·리셋·재시작·오프라인 전 경로의 상태 일관성을 서버 권위 상태 기준으로 정리하고, 테마 3-way와 접근성을 더했다.

### Added
- 테마 3-way 전환(system/light/dark) + 랜딩 페이지 시맨틱 마크업·테마 스위처 (#20)
- 크로스디바이스 동시 start 레이스로 남은 다중 RUNNING을 읽기(GET) 경로에서 최신 1개로 화해 — 락·스키마 변경 없이 자가 수렴

### Changed
- 타이머 화면 통계 순서 변경 — Today's tag time을 record time 앞으로

### Fixed
- 타이머 정지 시 daily/tag/total 누적을 로컬에 복원 — 정지→재시작·정지 직후 통계가 이전 값으로 잠깐 떨어지던 문제 제거 (#21)
- 서버 `reset()`이 실행 상태(`timerState`·`latestStartTime`)를 멈추지 않아, 로컬 캐시를 지운 무상태 클라이언트(웹·시크릿창)가 유령 러닝을 무한 재현하던 근본 문제 수정
- Service Worker가 태그 API(초당 바뀌는 러닝 상태)를 캐싱해 stale 러닝을 서빙하던 문제 — SW 캐싱에서 제외 (#17)
- 오프라인 재전송 큐가 정지·삭제로 무효화된 start를 재생해 유령 러닝을 부활시키던 문제 (#16)
- 오늘 기록 시간 집계가 회원의 `dailyResetHour`를 무시하던 문제 + 오늘 요약 캐시를 프로필 저장 시 즉시 무효화
- topbar 상단 safe-area-inset 반영, 기록 화면 뒤로가기 버튼 터치 영역 확대

## [0.6.0] - 2026-07-01

보안 하드닝과 운영 관측성(구조화 로깅·피드백·콘솔 집계)에 집중한 릴리스.

### Added
- 회원가입 엔드포인트 레이트리밋 및 비밀번호 복잡도 검증 추가
- refresh 실패를 분류해 네트워크/일시 장애 시 불필요한 재로그인 방지 (401/400만 세션 정리, 5xx/타임아웃은 세션 유지)
- 최근 태그 선택 UX 개선
- `lab.mungji` 콘솔 집계용 내부 엔드포인트 추가 + `SecurityConfig` 체인 매칭 강화
- JWT `userId`를 MDC에 실어 logstash JSON 구조화 로그 출력
- HTTP 요청당 1줄 access log 추가 (`logger_name=access`)
- 개발자 피드백 수집 엔드포인트 추가 (토큰 검증 + NetworkPolicy)

### Security
- X-Forwarded-For 헤더 위조로 인한 IP 기반 rate limit 우회 차단 — 신뢰 프록시 allowlist 기반으로 클라이언트 IP 판정 (GLOBAL-PIT-009)
- Refresh token을 Redis에 평문 저장하던 취약점 수정 — `@Id`를 원문 토큰 대신 `sha256(refreshToken)` 해시로 저장해 Redis 유출 시 세션 탈취 차단 (GLOBAL-PIT-001)

### Fixed
- iOS PWA에서 앱 서스펜드 시 쿠키 flush 실패로 발생하던 강제 로그아웃 방어 — 24시간 조건부 토큰 회전 (GLOBAL-PIT-051), 회전 주기 환경변수화
- 콜드 스타트 세션 복원이 `localStorage.memberId` 존재 여부에 게이트되던 문제 수정 — 쿠키가 살아있으면 캐시와 무관하게 refresh 시도 (GLOBAL-PIT-053)
- 타이머 리셋 상태 크로스 디바이스 동기화 수정

## [0.5.0] - 2026-06-08

프론트엔드를 **Vue3+Vite에서 Next.js 15 + React 19로 전면 재작성**하고, 인프라 보안과 다국어를 강화한 릴리스.

### Added
- **프론트엔드 전면 재작성**: Vue3 + Vite → Next.js 15 + React 19
- NetworkPolicy 도입 — default-deny-all + 컴포넌트별 allowlist
- SSR 기반 관리자 패널 구축 및 보안 강화
- Flyway 데이터베이스 마이그레이션 도입
- 9개 언어 다국어(i18n) UI 지원
- UI 3탭 구조 재편 — TodayView 메인 페이지 + 하단 TabBar 도입
- 통합 타이머 페이지 (태그 전환 지원) 및 TimerView 싱크 개선
- 레코드 수정 시 태그 변경 기능
- Today 모달 태그 피커 — 계층 내비게이션, 최근 태그, 상위 태그 선택
- PWA manifest / Service Worker / Wake Lock 견고화, 재시작 시 세션 자동 복원
- iOS 설치 가이드 PWA 배너, 라이트 테마 및 CSS 토큰 정리
- k8s liveness/readiness probe 분리 + actuator health 의존성

### Security
- nonce 기반 CSP 완성 — strict-dynamic, base-uri, layout nonce
- 관리자 인증 강화 + Google OAuth 발급 JWT에서 ADMIN 권한 제외
- 관리자 credential 검증 하드닝

### Fixed
- Next.js 마이그레이션 정합성 및 App Router hydration용 CSP 이슈 해결
- router 네비게이션 가드의 localStorage JSON 파싱 오류 방어
- `selectTag` 레이스 컨디션 — 버전 카운터 및 언마운트 가드 추가
- TODAY 총계 글리치 및 활성 태그 라이브 연동 수정
- Flyway config 키, probe, 프론트엔드 리소스 배포 이슈 수정
- PVC `storageClassName` 고정으로 immutable-field 배포 실패 방지

## [0.4.0] - 2026-05-11

관리자 기능과 역할 기반 인증, 쿠키 기반 세션을 도입한 릴리스.

### Added
- 관리자 페이지 + 역할 기반 JWT + 보안 하드닝
- 레코드 시간 겹침 감지 — 2단계 사용자 확인
- 헤더에 오늘 총 시간 실시간 표시
- 일/주/월 로그 요약 페이지 및 하루 타임라인 + 라이브 타이머 인디케이터
- 태그 표시 순서 저장 + 형제 태그 드래그앤드롭 정렬
- 회원가입 시 비밀번호 조건 실시간 인디케이터
- 모달 UX 개선 — 비차단 오버레이, 포커스 처리
- 사용자별 타임존 및 일일 리셋 시각 설정 (Phase 2)

### Changed
- refresh token을 httpOnly 쿠키로 이전, TTL 30일로 연장
- 스케줄러에서 `ResetTagDailyTimesPort` 추출 + 잘못된 타임존 가드

### Security
- 보안 취약점 5건 수정
- Redis rate limiting 및 보안 쿠키 opt-out 패턴 추가

### Fixed
- 오프라인/캐시 관련 다수 수정 — 캐시 무효화, SW MIME 타입, IndexedDB DataCloneError, BackgroundSync → 수동 재시도 전환
- 크로스 디바이스 STOPPED 상태 및 자정 경계 dailyTotal 유지 문제 수정
- 회원 삭제 시 push subscription FK 위반 방지
- 타이머 일일 리셋 컷오프를 5AM KST로 조정
- RAF 누수 및 크로스 디바이스 타이머 데이터 정확성 버그 다수 수정
- same-origin ingress 환경의 CORS startup 실패 정리

## [0.3.0] - 2026-04-13

### Security
- IDOR 취약점 수정: `memberId`를 요청 파라미터/바디 대신 JWT에서 추출하도록 변경 (`TagApiController`, `RecordApiController`)
- 태그·레코드 소유권 검증 추가 — 타인 리소스 접근 시 400 반환
- H2 콘솔을 `local` 프로파일 전용으로 분리 (`SecurityConfigLocal`)
- `TagJpaEntity`에 `@Version` 낙관적 락 추가, 동시 수정 시 409 응답

### Fixed
- 타이머 자동 중지 시 `elapsedTime=0`으로 하드코딩되던 버그 수정 — 실제 경과 초로 계산
- `DailyGoalScheduler` 미구현 상태에서 매 시간 실행되던 문제 수정 (`@Scheduled` 비활성화)
- 오프라인 TagDetail 로딩 및 TagList 재접속 시 빈 상태 해결
- SW 캐시가 오프라인 타이머 상태를 덮어쓰는 문제 수정
- 타이머 restore 오류, NaN 표시, 일별 합계 계산 수정
- 앱 재오픈 또는 크로스 디바이스 접근 시 타이머 상태 복원 수정
- Google OAuth 신규 회원 기본 태그 초기화 수정
- 첫 태그 생성 시 에러 피드백 및 race condition 가드 추가
- CI/CD: GHCR 이미지 경로, imagePullSecrets, 프론트엔드 재시작 등 배포 파이프라인 수정

### Added
- 랜딩 페이지, 프로필 링크 수정, 계정 삭제 기능
- 로그인/회원가입 내비게이션 흐름 및 프로필 관리 페이지
- 오프라인 우선 지원 — 태그 캐싱 및 타이머 백그라운드 동기화
- TagList / TagDetail stale-while-revalidate 캐싱 및 pull-to-refresh
- 오프라인/온라인 UI 배너 및 재접속 시 자동 동기화
- 타이머 동작 중 Wake Lock 및 태그 페이지 라이브 인디케이터

### Changed
- `IllegalArgumentException` → `DomainException` 통일 (`TagCommandService`)
- `GlobalExceptionHandler`에 `IllegalArgumentException` (400), `MethodArgumentNotValidException` (400), `OptimisticLockingFailureException` (409) 핸들러 추가
- `PushNotificationService`가 웹 레이어 DTO 대신 `SavePushSubscriptionCommand`를 사용하도록 아키텍처 의존성 교정
- `Member.reconstitute(id, name)` 불완전 오버로드 제거
- `JwtTokenProviderImpl`의 서명 키를 `@PostConstruct`로 초기화 시 1회만 디코딩하도록 최적화
- k8s 매니페스트 클라우드 배포용 업데이트

## [0.2.0] - 2026-03-26

### Added
- Google OAuth 2.0 로그인 프론트엔드 통합 (Authorization Code Flow)
- `LoginView`: "Continue with Google" 버튼 (기존 디자인 시스템 유지)
- `OAuthCallbackView`: 콜백 코드 처리, 로딩 스피너, 에러 표시
- `/oauth/callback` 라우트 (public, `requiresAuth: false`)
- `useAuth` composable: `googleLogin(code, redirectUri)` 함수 추가
- `auth.js` API: `googleLogin(code, redirectUri)` 추가
- Google OAuth 백엔드: `GoogleOAuthAdapter`, `GoogleAuthCommandService`, `GoogleLoginUseCase`
- `OAuthProvider` enum (LOCAL / GOOGLE), `Member` 도메인 OAuth 필드 추가
- CI/CD: ghcr.io 이미지 빌드/푸시, k3s 자동 배포 파이프라인

## [0.1.0] - 2026-03-17

### Added
- PWA 지원 추가 — 오프라인 캐싱, 백그라운드 동기화, 푸시 알림
- 헥사고날 아키텍처 기반 푸시 알림 인프라 구축
- 최소한의 다크 테마로 전체 화면 리디자인
- 태그 트리에 chevron 접기, 인라인 추가, 편집 모드, 드래그 앤 드롭 추가
- 요청 추적, 예외 핸들러, JWT 로깅 추가
- Docker 모노레포 지원 추가 (보안 포트 바인딩 포함)
- 도메인/서비스 단위 테스트 및 통합 테스트 추가

### Changed
- 헥사고날 아키텍처 (Ports & Adapters) 적용
- SOLID 위반(DIP, ISP, SRP) 수정 및 중복 제거, 관심사 분리
- 모든 엔드포인트와 프론트엔드 URL을 REST 계약에 맞게 정렬
- 태그 작업에서 N+1 쿼리 제거

### Fixed
- HTTP 상태 코드 수정 및 누락된 유효성 검사 추가
- Map 타임스탬프를 타입 레코드로 교체, null 안전성 수정
- BouncyCastle 프로바이더 중복 등록 방지

[Unreleased]: https://github.com/yeonjae1220/TimeManager/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/yeonjae1220/TimeManager/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/yeonjae1220/TimeManager/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/yeonjae1220/TimeManager/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/yeonjae1220/TimeManager/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/yeonjae1220/TimeManager/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/yeonjae1220/TimeManager/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yeonjae1220/TimeManager/releases/tag/v0.1.0
