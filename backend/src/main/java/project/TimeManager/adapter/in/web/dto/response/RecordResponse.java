package project.TimeManager.adapter.in.web.dto.response;

import project.TimeManager.application.dto.result.RecordResult;

import java.time.ZonedDateTime;

public class RecordResponse {
    private Long id;
    private ZonedDateTime startTime;
    private ZonedDateTime endTime;
    private Long totalTime;

    public static RecordResponse from(RecordResult result) {
        RecordResponse r = new RecordResponse();
        r.id = result.getId();
        r.startTime = result.getStartTime();
        r.endTime = result.getEndTime();
        r.totalTime = result.getTotalTime();
        return r;
    }

    public Long getId() { return id; }
    public ZonedDateTime getStartTime() { return startTime; }
    public ZonedDateTime getEndTime() { return endTime; }
    public Long getTotalTime() { return totalTime; }
}
