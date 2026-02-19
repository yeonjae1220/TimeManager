package project.TimeManager.application.dto.command;

import java.time.ZonedDateTime;

public record CreateRecordCommand(Long tagId, ZonedDateTime startTime, ZonedDateTime endTime) {}
