package project.TimeManager.adapter.in.web.dto.response;

import project.TimeManager.application.dto.result.TagResult;
import project.TimeManager.domain.tag.model.TagType;

import java.time.ZonedDateTime;
import java.util.List;

public class TagResponse {
    private Long id;
    private String name;
    private TagType type;
    private Long elapsedTime;
    private Long dailyGoalTime;
    private Long dailyElapsedTime;
    private Long dailyTotalTime;
    private Long tagTotalTime;
    private Long totalTime;
    private ZonedDateTime latestStartTime;
    private ZonedDateTime latestStopTime;
    private Boolean state;
    private Long memberId;
    private Long parentId;
    private List<Long> childrenList;

    public static TagResponse from(TagResult result) {
        TagResponse r = new TagResponse();
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
        r.state = result.getState();
        r.memberId = result.getMemberId();
        r.parentId = result.getParentId();
        r.childrenList = result.getChildrenList();
        return r;
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
