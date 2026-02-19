package project.TimeManager.application.dto.command;

import java.time.ZonedDateTime;

public record EditRecordTimeCommand(Long recordId, ZonedDateTime newStartTime, ZonedDateTime newEndTime) {}
