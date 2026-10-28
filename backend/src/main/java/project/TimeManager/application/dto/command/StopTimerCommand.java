package project.TimeManager.application.dto.command;

import java.time.ZonedDateTime;

public record StopTimerCommand(Long tagId, Long elapsedTime, ZonedDateTime startTime, ZonedDateTime endTime, Long memberId, boolean replay) {
    public StopTimerCommand(Long tagId, Long elapsedTime, ZonedDateTime startTime, ZonedDateTime endTime, Long memberId) {
        this(tagId, elapsedTime, startTime, endTime, memberId, false);
    }
}
