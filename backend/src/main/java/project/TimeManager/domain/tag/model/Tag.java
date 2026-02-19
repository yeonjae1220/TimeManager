package project.TimeManager.domain.tag.model;

import project.TimeManager.domain.member.model.MemberId;

import java.time.ZoneId;
import java.time.ZonedDateTime;

public class Tag {

    private TagId id;
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
    private TimerState timerState;
    private MemberId memberId;
    private TagId parentId;

    private Tag() {}

    public static Tag createCustomTag(String name, MemberId memberId, TagId parentId) {
        Tag tag = new Tag();
        tag.name = name;
        tag.type = TagType.CUSTOM;
        tag.memberId = memberId;
        tag.parentId = parentId;
        return tag.withDefaults();
    }

    public static Tag createRootTag(String name, MemberId memberId) {
        Tag tag = new Tag();
        tag.name = name;
        tag.type = TagType.ROOT;
        tag.memberId = memberId;
        tag.parentId = null;
        return tag.withDefaults();
    }

    public static Tag createDiscardedTag(String name, MemberId memberId, TagId rootId) {
        Tag tag = new Tag();
        tag.name = name;
        tag.type = TagType.DISCARDED;
        tag.memberId = memberId;
        tag.parentId = rootId;
        return tag.withDefaults();
    }

    public static Tag reconstitute(TagId id, String name, TagType type,
                                   Long elapsedTime, Long dailyGoalTime,
                                   Long dailyElapsedTime, Long dailyTotalTime,
                                   Long tagTotalTime, Long totalTime,
                                   ZonedDateTime latestStartTime, ZonedDateTime latestStopTime,
                                   TimerState timerState, MemberId memberId, TagId parentId) {
        Tag tag = new Tag();
        tag.id = id;
        tag.name = name;
        tag.type = type;
        tag.elapsedTime = elapsedTime;
        tag.dailyGoalTime = dailyGoalTime;
        tag.dailyElapsedTime = dailyElapsedTime;
        tag.dailyTotalTime = dailyTotalTime;
        tag.tagTotalTime = tagTotalTime;
        tag.totalTime = totalTime;
        tag.latestStartTime = latestStartTime;
        tag.latestStopTime = latestStopTime;
        tag.timerState = timerState;
        tag.memberId = memberId;
        tag.parentId = parentId;
        return tag;
    }

    private Tag withDefaults() {
        this.elapsedTime = 0L;
        this.dailyGoalTime = 0L;
        this.dailyElapsedTime = 0L;
        this.dailyTotalTime = 0L;
        this.tagTotalTime = 0L;
        this.totalTime = 0L;
        this.timerState = TimerState.STOPPED;
        ZonedDateTime epoch = ZonedDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneId.systemDefault());
        this.latestStartTime = epoch;
        this.latestStopTime = epoch;
        return this;
    }

    // Domain behavior

    public void start(ZonedDateTime startTime) {
        this.latestStartTime = startTime;
        this.timerState = TimerState.RUNNING;
    }

    public void stop(ZonedDateTime stopTime, Long elapsedTime) {
        this.latestStopTime = stopTime;
        this.elapsedTime = elapsedTime;
        this.timerState = TimerState.STOPPED;
    }

    public void reset(Long elapsedTime) {
        this.elapsedTime = elapsedTime;
    }

    public void moveTo(TagId newParentId) {
        this.parentId = newParentId;
    }

    public void updateTagTotalTime(Long delta) {
        this.tagTotalTime += delta;
    }

    public void updateDailyTotalTime(Long delta) {
        this.dailyTotalTime += delta;
    }

    public boolean isRunning() {
        return timerState == TimerState.RUNNING;
    }

    // Getters
    public TagId getId() { return id; }
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
    public TimerState getTimerState() { return timerState; }
    public MemberId getMemberId() { return memberId; }
    public TagId getParentId() { return parentId; }
}
