package project.TimeManager.application.dto.command;

import java.time.ZonedDateTime;

public record EditRecordTimeCommand(Long recordId, ZonedDateTime newStartTime, ZonedDateTime newEndTime, Long memberId, boolean forceOverwrite, Long newTagId, String overlapToken, String recordToken) {
    public EditRecordTimeCommand(Long recordId, ZonedDateTime newStartTime, ZonedDateTime newEndTime, Long memberId, boolean forceOverwrite, Long newTagId) { this(recordId, newStartTime, newEndTime, memberId, forceOverwrite, newTagId, null, null); }
}
