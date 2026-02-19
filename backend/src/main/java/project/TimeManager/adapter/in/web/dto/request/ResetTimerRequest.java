package project.TimeManager.adapter.in.web.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record ResetTimerRequest(
        @NotNull(message = "elapsedTime은 필수입니다")
        @PositiveOrZero(message = "elapsedTime은 0 이상이어야 합니다")
        Long elapsedTime
) {}
