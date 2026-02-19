package project.TimeManager.application.dto.result;

import java.time.ZonedDateTime;

public class RecordResult {
    private final Long id;
    private final ZonedDateTime startTime;
    private final ZonedDateTime endTime;
    private final Long totalTime;

    public RecordResult(Long id, ZonedDateTime startTime, ZonedDateTime endTime, Long totalTime) {
        this.id = id;
        this.startTime = startTime;
        this.endTime = endTime;
        this.totalTime = totalTime;
    }

    public Long getId() { return id; }
    public ZonedDateTime getStartTime() { return startTime; }
    public ZonedDateTime getEndTime() { return endTime; }
    public Long getTotalTime() { return totalTime; }
}
