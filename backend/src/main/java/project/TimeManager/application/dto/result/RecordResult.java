package project.TimeManager.application.dto.result;

import java.time.ZonedDateTime;

public class RecordResult {
    private final Long id;
    private final ZonedDateTime startTime;
    private final ZonedDateTime endTime;
    private final Long totalTime;
    private final Long tagId;

    public RecordResult(Long id, ZonedDateTime startTime, ZonedDateTime endTime, Long totalTime, Long tagId) {
        this.id = id;
        this.startTime = startTime;
        this.endTime = endTime;
        this.totalTime = totalTime;
        this.tagId = tagId;
    }

    public Long getId() { return id; }
    public ZonedDateTime getStartTime() { return startTime; }
    public ZonedDateTime getEndTime() { return endTime; }
    public Long getTotalTime() { return totalTime; }
    public Long getTagId() { return tagId; }
}
