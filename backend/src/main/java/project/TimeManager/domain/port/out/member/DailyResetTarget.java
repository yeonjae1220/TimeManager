package project.TimeManager.domain.port.out.member;

import java.time.Instant;

/**
 * 일일 리셋 배치가 회원 한 명에 대해 알아야 하는 전부.
 *
 * <p>{@code Member} 애그리거트를 통째로 싣지 않는다 — 배치는 이메일·비밀번호 해시가
 * 필요 없고, {@code lastResetBoundaryAt} 은 회원의 도메인 상태가 아니라 <b>배치의 진행
 * 기록</b>이라 애그리거트에 섞으면 의미가 흐려진다.
 *
 * @param lastResetBoundaryAt 마지막으로 처리한 <b>경계 시각</b>이다 — 리셋을 실행한 시각이
 *                            아니다. 경계는 회원 타임존에서 {@code dailyResetHour} 정각이며,
 *                            이 값이 직전 경계보다 이르면 그 경계는 아직 처리되지 않았다.
 *                            실행 시각이 아니라 경계를 저장해야 DST 로 하루가 23·25시간이
 *                            되는 날에도 판정이 어긋나지 않는다.
 */
public record DailyResetTarget(
        Long memberId,
        String timezone,
        int dailyResetHour,
        Instant lastResetBoundaryAt
) {}
