package project.TimeManager.application.dto.command;

import java.time.ZonedDateTime;

public record CreateRecordCommand(Long tagId, ZonedDateTime startTime, ZonedDateTime endTime, boolean forceOverwrite, String overlapToken) {
    public CreateRecordCommand(Long tagId, ZonedDateTime startTime, ZonedDateTime endTime, boolean forceOverwrite) { this(tagId, startTime, endTime, forceOverwrite, null); }
}
