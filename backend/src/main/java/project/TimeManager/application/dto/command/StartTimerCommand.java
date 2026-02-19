package project.TimeManager.application.dto.command;

import java.time.ZonedDateTime;

public record StartTimerCommand(Long tagId, ZonedDateTime startTime) {}
