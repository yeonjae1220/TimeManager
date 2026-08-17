package project.TimeManager.adapter.in.web.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * 오늘 목표 시간(초). 0 은 "목표 없음"이고 상한은 하루(86400초)다.
 * 하루를 넘는 목표는 어떤 해석으로도 달성 불가라 도메인 불변식으로 막는다.
 */
public record SetDailyGoalRequest(
        @NotNull(message = "목표 시간은 필수입니다")
        @Min(value = 0, message = "목표 시간은 0초 이상이어야 합니다")
        @Max(value = 86400, message = "목표 시간은 하루(86400초)를 넘을 수 없습니다")
        Long dailyGoalTime
) {}
