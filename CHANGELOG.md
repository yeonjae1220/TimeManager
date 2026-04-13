# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

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
- feat(pwa): PWA 지원 추가 — 오프라인 캐싱, 백그라운드 동기화, 푸시 알림
- feat(notification): 헥사고날 아키텍처 기반 푸시 알림 인프라 구축
- feat(ui): 최소한의 다크 테마로 전체 화면 리디자인
- feat(ui): 태그 트리에 chevron 접기, 인라인 추가, 편집 모드, 드래그 앤 드롭 추가
- feat(logging): 요청 추적, 예외 핸들러, JWT 로깅 추가
- chore: Docker 모노레포 지원 추가 (보안 포트 바인딩 포함)
- test: 도메인/서비스 단위 테스트 및 통합 테스트 추가

### Changed
- refactor(architecture): 헥사고날 아키텍처 (Ports & Adapters) 적용
- refactor(solid): DIP, ISP, SRP 위반 수정
- refactor(patterns): 중복 제거 및 관심사 분리
- refactor(api): 모든 엔드포인트와 프론트엔드 URL을 REST 계약에 맞게 정렬
- perf(persistence): 태그 작업에서 N+1 쿼리 제거
- refactor: 백엔드 전반 클린 코드 개선

### Fixed
- fix(api): HTTP 상태 코드 수정 및 누락된 유효성 검사 추가
- fix(api): Map 타임스탬프를 타입 레코드로 교체, null 안전성 수정
- fix(push): BouncyCastle 프로바이더 중복 등록 방지

[unreleased]: https://github.com/yeonjae1220/TimeManager/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/yeonjae1220/TimeManager/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/yeonjae1220/TimeManager/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yeonjae1220/TimeManager/releases/tag/v0.1.0
