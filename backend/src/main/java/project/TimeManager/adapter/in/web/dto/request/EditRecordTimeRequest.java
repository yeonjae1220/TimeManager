package project.TimeManager.adapter.in.web.dto.request;

import jakarta.validation.constraints.NotNull;
import java.time.ZonedDateTime;

public record EditRecordTimeRequest(
        @NotNull(message = "시작 시간은 필수입니다") ZonedDateTime newStartTime,
        @NotNull(message = "종료 시간은 필수입니다") ZonedDateTime newEndTime
) {}
