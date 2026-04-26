package project.TimeManager.adapter.in.web.dto.response;

import project.TimeManager.application.dto.result.TagResult;
import project.TimeManager.domain.tag.model.TagType;

import java.time.ZonedDateTime;

public abstract class BaseTagResponse {

    protected Long id;
    protected String name;
    protected TagType type;
    protected Long elapsedTime;
    protected Long dailyGoalTime;
    protected Long dailyElapsedTime;
    protected Long dailyTotalTime;
    protected Long tagTotalTime;
    protected Long totalTime;
    protected ZonedDateTime latestStartTime;
    protected ZonedDateTime latestStopTime;
    protected Long latestStartTimeMs;
    protected Long latestStopTimeMs;
    protected Boolean state;
    protected Long memberId;
    protected Long parentId;
    protected Integer displayOrder;

    protected static void populate(BaseTagResponse r, TagResult result) {
        r.id = result.getId();
        r.name = result.getName();
        r.type = result.getType();
        r.elapsedTime = result.getElapsedTime();
        r.dailyGoalTime = result.getDailyGoalTime();
        r.dailyElapsedTime = result.getDailyElapsedTime();
        r.dailyTotalTime = result.getDailyTotalTime();
        r.tagTotalTime = result.getTagTotalTime();
        r.totalTime = result.getTotalTime();
        r.latestStartTime = result.getLatestStartTime();
        r.latestStopTime = result.getLatestStopTime();
        r.latestStartTimeMs = result.getLatestStartTime() != null
                ? result.getLatestStartTime().toInstant().toEpochMilli() : 0L;
        r.latestStopTimeMs = result.getLatestStopTime() != null
                ? result.getLatestStopTime().toInstant().toEpochMilli() : 0L;
        r.state = result.getState();
        r.memberId = result.getMemberId();
        r.parentId = result.getParentId();
        r.displayOrder = result.getDisplayOrder();
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public TagType getType() { return type; }
    public Long getElapsedTime() { return elapsedTime; }
    public Long getDailyGoalTime() { return dailyGoalTime; }
    public Long getDailyElapsedTime() { return dailyElapsedTime; }
    public Long getDailyTotalTime() { return dailyTotalTime; }
    public Long getTagTotalTime() { return tagTotalTime; }
    public Long getTotalTime() { return totalTime; }
    public ZonedDateTime getLatestStartTime() { return latestStartTime; }
    public ZonedDateTime getLatestStopTime() { return latestStopTime; }
    public Long getLatestStartTimeMs() { return latestStartTimeMs; }
    public Long getLatestStopTimeMs() { return latestStopTimeMs; }
    public Boolean getState() { return state; }
    public Long getMemberId() { return memberId; }
    public Long getParentId() { return parentId; }
    public Integer getDisplayOrder() { return displayOrder; }
}
