# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

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

[unreleased]: https://github.com/yeonjae1220/TimeManager/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yeonjae1220/TimeManager/releases/tag/v0.1.0
