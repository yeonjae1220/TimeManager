package project.TimeManager.application.dto.result;

import project.TimeManager.domain.tag.model.TagType;

import java.time.ZonedDateTime;
import java.util.List;

public class TagResult {
    private final Long id;
    private final String name;
    private final TagType type;
    private final Long elapsedTime;
    private final Long dailyGoalTime;
    private final Long dailyElapsedTime;
    private final Long dailyTotalTime;
    private final Long tagTotalTime;
    private final Long totalTime;
    private final ZonedDateTime latestStartTime;
    private final ZonedDateTime latestStopTime;
    private final Boolean state;
    private final Long memberId;
    private final Long parentId;
    private final List<Long> childrenList;

    public TagResult(Long id, String name, TagType type,
                     Long elapsedTime, Long dailyGoalTime,
                     Long dailyElapsedTime, Long dailyTotalTime,
                     Long tagTotalTime, Long totalTime,
                     ZonedDateTime latestStartTime, ZonedDateTime latestStopTime,
                     Boolean state, Long memberId, Long parentId, List<Long> childrenList) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.elapsedTime = elapsedTime;
        this.dailyGoalTime = dailyGoalTime;
        this.dailyElapsedTime = dailyElapsedTime;
        this.dailyTotalTime = dailyTotalTime;
        this.tagTotalTime = tagTotalTime;
        this.totalTime = totalTime;
        this.latestStartTime = latestStartTime;
        this.latestStopTime = latestStopTime;
        this.state = state;
        this.memberId = memberId;
        this.parentId = parentId;
        this.childrenList = childrenList;
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
    public Boolean getState() { return state; }
    public Long getMemberId() { return memberId; }
    public Long getParentId() { return parentId; }
    public List<Long> getChildrenList() { return childrenList; }
}
