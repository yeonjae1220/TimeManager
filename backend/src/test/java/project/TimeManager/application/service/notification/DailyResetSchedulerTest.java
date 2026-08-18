package project.TimeManager.application.service.notification;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import project.TimeManager.domain.port.out.member.DailyResetTarget;
import project.TimeManager.domain.port.out.member.LoadDailyResetTargetsPort;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;

/**
 * 이 스케줄러의 책임은 두 가지다 — <b>놓친 경계를 따라잡는 것</b>과 <b>실패를 격리하는 것</b>.
 *
 * <p>예전에는 "지금 시각 == dailyResetHour" 로 대상을 골랐다. 그래서 그 정각에 파드가
 * 안 떠 있으면(배포·재시작·다운) 그날치가 통째로 사라지고 한 시간 뒤엔 조건이 안 맞았다.
 * 지금은 "마지막으로 처리한 경계"를 회원마다 들고 있고, 지나간 경계가 아직 미처리면
 * <b>몇 시에 돌든</b> 리셋한다.
 *
 * <p>고정 시계를 주입한다. 경계 계산이 이 클래스의 핵심 로직이 됐으므로 "지금 몇 시냐"에
 * 결과가 흔들리면 테스트가 검증하는 게 없어진다. 기준 시각은 <b>Asia/Seoul 08-19 05:05</b>
 * (= 08-18T20:05Z) — 리셋 시각 5시를 5분 지난 순간이다.
 */
@ExtendWith(MockitoExtension.class)
class DailyResetSchedulerTest {

    private static final String SEOUL = "Asia/Seoul";

    /** 2026-08-19 05:05 KST — 오늘 경계(05:00)를 5분 지났다. */
    private static final Instant NOW = Instant.parse("2026-08-18T20:05:00Z");
    /** 위 시각 기준 "가장 최근에 지나간 경계" = 2026-08-19 05:00 KST. */
    private static final Instant TODAY_BOUNDARY = Instant.parse("2026-08-18T20:00:00Z");
    private static final Instant YESTERDAY_BOUNDARY = Instant.parse("2026-08-17T20:00:00Z");

    @Mock
    private LoadDailyResetTargetsPort loadDailyResetTargetsPort;

    @Mock
    private MemberDailyResetter memberDailyResetter;

    private DailyResetScheduler scheduler;
    private Logger schedulerLogger;
    private ListAppender<ILoggingEvent> logs;

    @BeforeEach
    void setUp() {
        scheduler = newSchedulerAt(NOW);
        schedulerLogger = (Logger) LoggerFactory.getLogger(DailyResetScheduler.class);
        logs = new ListAppender<>();
        logs.start();
        schedulerLogger.addAppender(logs);
    }

    @AfterEach
    void releaseLogs() {
        schedulerLogger.detachAppender(logs);
    }

    private DailyResetScheduler newSchedulerAt(Instant now) {
        return new DailyResetScheduler(loadDailyResetTargetsPort, memberDailyResetter,
                Clock.fixed(now, ZoneOffset.UTC));
    }

    private void givenTargets(DailyResetTarget... targets) {
        given(loadDailyResetTargetsPort.loadDailyResetTargets()).willReturn(List.of(targets));
    }

    /** 리셋 시각 5시, 마지막 처리 경계가 {@code lastBoundary} 인 회원. */
    private static DailyResetTarget target(long id, Instant lastBoundary) {
        return new DailyResetTarget(id, SEOUL, 5, lastBoundary);
    }

    /** 이번 실행이 남긴 요약 줄. 매 실행마다 정확히 하나여야 한다. */
    private ILoggingEvent summaryLine() {
        List<ILoggingEvent> summaries = logs.list.stream()
                .filter(e -> e.getFormattedMessage().contains("스캔"))
                .toList();
        assertThat(summaries).hasSize(1);
        return summaries.get(0);
    }

    // ── 경계 판정 ────────────────────────────────────────────────────

    @Test
    @DisplayName("경계가 지났고 아직 처리 전이면 그 경계로 리셋한다")
    void resetsWhenBoundaryHasPassed() {
        givenTargets(target(1L, YESTERDAY_BOUNDARY));

        scheduler.resetDailyTimes();

        then(memberDailyResetter).should().resetOne(1L, TODAY_BOUNDARY);
    }

    @Test
    @DisplayName("이미 처리한 경계는 다시 리셋하지 않는다 — 매시 돌아도 하루 한 번")
    void doesNotResetTheSameBoundaryTwice() {
        givenTargets(target(1L, TODAY_BOUNDARY));

        scheduler.resetDailyTimes();

        then(memberDailyResetter).shouldHaveNoInteractions();
    }

    @Test
    @DisplayName("가입 직후 회원은 첫 경계가 올 때까지 리셋되지 않는다")
    void doesNotResetBrandNewMemberBeforeItsFirstBoundary() {
        // 오늘 경계(05:00 KST)가 지난 뒤인 07:00 KST 에 가입한 회원
        givenTargets(target(1L, Instant.parse("2026-08-18T22:00:00Z")));

        newSchedulerAt(Instant.parse("2026-08-18T23:30:00Z")).resetDailyTimes();

        then(memberDailyResetter).shouldHaveNoInteractions();
    }

    // ── 따라잡기 (이번 변경의 핵심) ──────────────────────────────────

    @Test
    @DisplayName("경계 시각에 파드가 꺼져 있었어도 다음 실행에서 따라잡는다")
    void catchesUpAMissedBoundaryAtANonBoundaryHour() {
        // 08-19 08:30 KST — 리셋 시각(5시)이 아니다. 예전 코드라면 그냥 건너뛰었다.
        Instant lateMorning = Instant.parse("2026-08-18T23:30:00Z");
        givenTargets(target(1L, YESTERDAY_BOUNDARY));

        newSchedulerAt(lateMorning).resetDailyTimes();

        then(memberDailyResetter).should().resetOne(1L, TODAY_BOUNDARY);
    }

    @Test
    @DisplayName("며칠을 놓쳤어도 따라잡기는 가장 최근 경계 한 번이다")
    void catchUpCollapsesMultipleMissedBoundariesIntoOne() {
        givenTargets(target(1L, Instant.parse("2026-08-15T20:00:00Z")));

        scheduler.resetDailyTimes();

        then(memberDailyResetter).should().resetOne(1L, TODAY_BOUNDARY);
        then(memberDailyResetter).shouldHaveNoMoreInteractions();
    }

    @Test
    @DisplayName("따라잡은 리셋은 WARN 으로 남는다 — 정시 실행과 구분되어야 한다")
    void lateResetIsLoggedAsWarning() {
        givenTargets(target(1L, YESTERDAY_BOUNDARY));

        newSchedulerAt(Instant.parse("2026-08-18T23:30:00Z")).resetDailyTimes();

        assertThat(logs.list).anyMatch(e -> e.getLevel() == Level.WARN
                && e.getFormattedMessage().contains("CATCH-UP")
                && e.getFormattedMessage().contains("따라잡"));
    }

    @Test
    @DisplayName("정시에 처리한 리셋은 WARN 을 남기지 않는다")
    void onTimeResetIsNotFlaggedAsLate() {
        givenTargets(target(1L, YESTERDAY_BOUNDARY));

        scheduler.resetDailyTimes();

        assertThat(logs.list).noneMatch(e -> e.getLevel() == Level.WARN);
    }

    // ── 실패 격리 ────────────────────────────────────────────────────

    @Test
    @DisplayName("한 회원의 리셋이 실패해도 나머지 회원은 계속 리셋된다")
    void oneFailureDoesNotBlockTheRest() {
        givenTargets(target(1L, YESTERDAY_BOUNDARY), target(2L, YESTERDAY_BOUNDARY),
                target(3L, YESTERDAY_BOUNDARY));
        willThrow(new RuntimeException("lock timeout"))
                .given(memberDailyResetter).resetOne(2L, TODAY_BOUNDARY);

        scheduler.resetDailyTimes();

        then(memberDailyResetter).should().resetOne(1L, TODAY_BOUNDARY);
        then(memberDailyResetter).should().resetOne(3L, TODAY_BOUNDARY);
    }

    @Test
    @DisplayName("리셋 실패가 스케줄러 밖으로 새어나가지 않는다")
    void failureDoesNotEscape() {
        givenTargets(target(1L, YESTERDAY_BOUNDARY));
        willThrow(new RuntimeException("boom"))
                .given(memberDailyResetter).resetOne(1L, TODAY_BOUNDARY);

        assertThatCode(() -> scheduler.resetDailyTimes()).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("timezone 이 깨진 회원 하나가 다른 회원의 리셋을 막지 않는다")
    void brokenTimezoneIsIsolated() {
        givenTargets(new DailyResetTarget(1L, "Not/AZone", 5, YESTERDAY_BOUNDARY),
                target(2L, YESTERDAY_BOUNDARY));

        scheduler.resetDailyTimes();

        then(memberDailyResetter).should(never()).resetOne(1L, TODAY_BOUNDARY);
        then(memberDailyResetter).should().resetOne(2L, TODAY_BOUNDARY);
    }

    // ── 요약 로그 ────────────────────────────────────────────────────

    @Test
    @DisplayName("대상이 0명이어도 요약 로그가 남는다 — 침묵은 '안 돌았다'와 구분되지 않는다")
    void logsSummaryEvenWhenNobodyIsDue() {
        givenTargets(target(1L, TODAY_BOUNDARY), target(2L, TODAY_BOUNDARY));

        scheduler.resetDailyTimes();

        ILoggingEvent summary = summaryLine();
        assertThat(summary.getLevel()).isEqualTo(Level.INFO);
        assertThat(summary.getFormattedMessage()).contains("[Daily Reset]").contains("2");
    }

    @Test
    @DisplayName("회원이 한 명도 없어도 요약 로그가 남는다")
    void logsSummaryWhenThereAreNoMembersAtAll() {
        givenTargets();

        scheduler.resetDailyTimes();

        assertThat(summaryLine().getLevel()).isEqualTo(Level.INFO);
    }

    @Test
    @DisplayName("실패가 있으면 요약이 ERROR 로 올라간다")
    void summaryEscalatesToErrorOnFailure() {
        givenTargets(target(1L, YESTERDAY_BOUNDARY), target(2L, YESTERDAY_BOUNDARY));
        willThrow(new RuntimeException("lock timeout"))
                .given(memberDailyResetter).resetOne(2L, TODAY_BOUNDARY);

        scheduler.resetDailyTimes();

        ILoggingEvent summary = summaryLine();
        assertThat(summary.getLevel()).isEqualTo(Level.ERROR);
        assertThat(summary.getFormattedMessage()).contains("실패");
    }

    @Test
    @DisplayName("따라잡은 건수가 요약에 집계된다")
    void summaryCountsCatchUps() {
        givenTargets(target(1L, YESTERDAY_BOUNDARY));

        newSchedulerAt(Instant.parse("2026-08-18T23:30:00Z")).resetDailyTimes();

        assertThat(summaryLine().getFormattedMessage()).contains("따라잡");
    }
}
