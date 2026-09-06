package project.TimeManager.domain.tag.model;

import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.member.model.MemberId;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;

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

    /**
     * 기록(Record)으로부터 파생 필드를 재계산해 반영한다.
     * <p>
     * {@code latestStopTime} 만은 <b>전진만</b> 한다. 이 값은 단순한 표시용 파생값이 아니라
     * "서버가 이 태그의 정지를 관측한 시각"이고, 다른 기기가 자기 로컬 스냅샷과 서버 중
     * 무엇을 믿을지 판정하는 기준이기 때문이다. 기록에서 재계산한 값으로 그대로 덮으면,
     * 마지막 기록을 지운 순간 그 시각이 EPOCH(또는 더 오래된 기록의 종료시각)로 후퇴해
     * "정지했다"는 증거가 사라진다. 그러면 그 태그를 켜둔 채로 있던 다른 기기의 로컬
     * 스냅샷이 서버를 이겨 유령 러닝이 부활하고, 거기서 정지를 누르면 옛 시작시각 기준의
     * 거대한 기록이 새로 만들어진다.
     */
    public void synchronizeRecordDerivedFields(Long tagTotalTime, Long dailyTotalTime,
                                               ZonedDateTime latestStartTime, ZonedDateTime latestStopTime) {
        this.tagTotalTime = tagTotalTime;
        this.dailyTotalTime = dailyTotalTime;
        this.latestStartTime = latestStartTime != null ? latestStartTime : EPOCH;

        ZonedDateTime candidate = latestStopTime != null ? latestStopTime : EPOCH;
        boolean advances = this.latestStopTime == null || candidate.isAfter(this.latestStopTime);
        this.latestStopTime = advances ? candidate : this.latestStopTime;
    }

    public boolean isRunning() {
        return timerState == TimerState.RUNNING;
    }

    /**
     * 센티넬로 볼 상한. 센티넬은 "1970-01-01 00:00 (쓴 쪽의 타임존)" 이라 절대시각이
     * 타임존에 따라 ±18시간 흔들린다 — JVM 기본 타임존의 EPOCH 하나만 기준으로 삼으면
     * 다른 타임존에서 쓰인 센티넬이 "실제 시각"으로 통과해 1970년부터의 거대한 구간이
     * 만들어진다. 어떤 타임존의 1970-01-01 이든 덮도록 하루 여유를 둔다(실제 데이터는
     * 전부 서비스 개시 이후이므로 이 경계에 걸릴 실제 값은 없다).
     */
    private static final Instant SENTINEL_UPPER_BOUND = Instant.EPOCH.plus(1, ChronoUnit.DAYS);

    /**
     * {@code latestStartTime}/{@code latestStopTime} 은 "값 없음"을 null 이 아니라 EPOCH 센티넬로
     * 표현한다(withDefaults·reset·haltRunWithoutRecording). 센티넬을 실제 시각으로 착각하면
     * 1970년부터의 거대한 구간이 만들어지므로, 판정은 반드시 이 두 메서드로 한다.
     */
    private static boolean isRealInstant(ZonedDateTime candidate) {
        return candidate != null && candidate.toInstant().isAfter(SENTINEL_UPPER_BOUND);
    }

    /** 실행 기준 시작시각이 센티넬이 아닌 실제 시각인가. */
    public boolean hasStartAnchor() {
        return isRealInstant(latestStartTime);
    }

    /** 서버가 이 태그의 정지를 관측한 적이 있는가. */
    public boolean hasStopMark() {
        return isRealInstant(latestStopTime);
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
