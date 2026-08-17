package project.TimeManager.domain.tag.model;

import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.member.model.MemberId;

import java.time.ZoneId;
import java.time.ZonedDateTime;

public class Tag {

    /** 하루 = 86400초. dailyGoalTime 의 상한. */
    private static final long SECONDS_PER_DAY = 86_400L;

    private static final ZonedDateTime EPOCH = ZonedDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneId.systemDefault());

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
        this.latestStartTime = EPOCH;
        this.latestStopTime = EPOCH;
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
        // 리셋은 "0으로 만들고 정지"를 의미한다. timerState/latestStartTime을 함께 비우지 않으면
        // 서버가 RUNNING + 옛 시작시각을 계속 들고 있어, 신규 클라이언트(웹·캐시 삭제)가 유령 러닝을
        // 재현한다(옛 시작시각 기준으로 무한히 증가). GLOBAL 유령 러닝 근본 원인.
        this.timerState = TimerState.STOPPED;
        this.latestStartTime = EPOCH;
    }

    /**
     * 멤버당 최대 1개여야 할 RUNNING 태그가 (동시 start 레이스·과거 결함으로) 여러 개 쌓였을 때,
     * 승자가 아닌 태그의 실행 상태를 화해(정지)시킨다.
     * <p>
     * reset과 달리 elapsedTime(누적 시간)은 보존하고, 기록(Record)도 만들지 않는다 —
     * 이 정지는 사용자의 명시적 정지가 아니라 유령/레이스 아티팩트 정리이므로 임의의 구간을
     * 기록으로 날조하거나 누적 시간을 부풀리지 않는다. 다만 권위 상태(RUNNING 플래그 + 기준
     * 시작시각)는 반드시 함께 비워야 무상태 클라이언트(웹·시크릿창)가 옛 시작시각 기준으로
     * 유령 러닝을 재현하지 않는다(GLOBAL 유령 러닝 원인과 동일).
     */
    public void haltRunWithoutRecording() {
        this.timerState = TimerState.STOPPED;
        this.latestStartTime = EPOCH;
    }

    public void moveTo(TagId newParentId) {
        this.parentId = newParentId;
    }

    public void rename(String newName) {
        this.name = newName;
    }

    /**
     * 오늘 목표 시간(초)을 설정한다. 0 은 "목표 없음"이다.
     * 하루(86400초)를 넘는 목표는 어떤 해석으로도 달성할 수 없으므로 불변식으로 막는다.
     */
    public void updateDailyGoalTime(Long newDailyGoalTime) {
        if (newDailyGoalTime == null || newDailyGoalTime < 0 || newDailyGoalTime > SECONDS_PER_DAY) {
            throw new DomainException("목표 시간은 0초 이상 " + SECONDS_PER_DAY + "초 이하여야 합니다: " + newDailyGoalTime);
        }
        this.dailyGoalTime = newDailyGoalTime;
    }

    public void updateTagTotalTime(Long delta) {
        this.tagTotalTime += delta;
    }

    public void updateDailyTotalTime(Long delta) {
        this.dailyTotalTime += delta;
    }

    public void synchronizeRecordDerivedFields(Long tagTotalTime, Long dailyTotalTime,
                                               ZonedDateTime latestStartTime, ZonedDateTime latestStopTime) {
        this.tagTotalTime = tagTotalTime;
        this.dailyTotalTime = dailyTotalTime;
        this.latestStartTime = latestStartTime != null ? latestStartTime : EPOCH;
        this.latestStopTime = latestStopTime != null ? latestStopTime : EPOCH;
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
