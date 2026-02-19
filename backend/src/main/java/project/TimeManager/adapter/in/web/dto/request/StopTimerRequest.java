package project.TimeManager.adapter.in.web.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.ZonedDateTime;
import java.util.Map;

public record StopTimerRequest(
        @NotNull(message = "elapsedTime은 필수입니다")
        @PositiveOrZero(message = "elapsedTime은 0 이상이어야 합니다")
        Long elapsedTime,

        @NotNull(message = "timestamps는 필수입니다")
        Map<String, ZonedDateTime> timestamps
) {}
