package project.TimeManager.adapter.in.web.dto.request;

import jakarta.validation.constraints.NotNull;
import java.time.ZonedDateTime;

public record CreateRecordRequest(
        @NotNull Long tagId,
        @NotNull ZonedDateTime newStartTime,
        @NotNull ZonedDateTime newEndTime
) {}
