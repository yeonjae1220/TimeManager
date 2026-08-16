package project.TimeManager.application.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * EC9 — 일일 리셋 시각을 가로지르는 세션의 "하루" 귀속 규칙.
 *
 * 이 앱에는 하루 경계를 계산하는 곳이 둘이고, 둘이 어긋나면 같은 세션이 화면마다 다른
 * 날짜로 집계된다(오늘 화면의 dailyTotalTime vs 기록 화면의 요약).
 *
 *   A) RecordSummaryService      — [startDate 00:00 +resetHour, endDate+1 00:00 +resetHour]
 *                                  구간을 startTime 으로 조회(Spring Data Between)
 *   B) TagRecordDerivedFieldsSyncService.isToday
 *                                — [todayReset, todayReset+1d) 를 startTime 으로 판정
 *
 * 오프라인 세션도 명시적 start/end 타임스탬프로 전송되므로 온라인 세션과 같은 규칙을 탄다.
 * 여기서는 규칙 자체를 고정해 두 경로가 같은 답을 내는지 확인한다.
 */
@DisplayName("일일 경계 귀속 규칙 (EC9)")
class DayBoundaryAttributionTest {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final int RESET_HOUR = 5;

    /** RecordSummaryService 와 동일한 구간 계산. */
    private static ZonedDateTime summaryStart(LocalDate day) {
        return day.atStartOfDay(SEOUL).plusHours(RESET_HOUR);
    }

    private static ZonedDateTime summaryEnd(LocalDate day) {
        return day.plusDays(1).atStartOfDay(SEOUL).plusHours(RESET_HOUR);
    }

    /**
     * 조회 경로(A)를 그대로 흉내낸다.
     * 메서드 이름은 findByMemberIdAndStartTimeBetween 이지만 Spring Data 파생 쿼리가 아니라
     * QueryDSL 커스텀 구현이고, 조건은 goe(start) + lt(end) 즉 반개구간 [start, end) 이다.
     * (이름만 보고 Between = 양끝 포함으로 읽으면 오해한다.)
     */
    private static boolean includedInSummary(ZonedDateTime startTime, LocalDate day) {
        ZonedDateTime s = summaryStart(day);
        ZonedDateTime e = summaryEnd(day);
        return !startTime.isBefore(s) && startTime.isBefore(e);
    }

    /** TagRecordDerivedFieldsSyncService.isToday 와 동일한 판정(경로 B). now 를 주입 가능하게 옮겨 적었다. */
    private static boolean isToday(ZonedDateTime sessionTime, ZonedDateTime now) {
        ZonedDateTime todayReset = now.toLocalDate().atStartOfDay(SEOUL).plusHours(RESET_HOUR);
        if (now.isBefore(todayReset)) {
            todayReset = todayReset.minusDays(1);
        }
        ZonedDateTime nextReset = todayReset.plusDays(1);
        ZonedDateTime inZone = sessionTime.withZoneSameInstant(SEOUL);
        return !inZone.isBefore(todayReset) && inZone.isBefore(nextReset);
    }

    @Nested
    @DisplayName("경계를 가로지르는 세션")
    class SpanningSession {

        @Test
        @DisplayName("리셋 직전에 시작해 리셋 이후에 끝나면 '시작한 날'에 통째로 귀속된다")
        void spanningSession_belongsToStartDay() {
            LocalDate day = LocalDate.of(2026, 8, 15);
            // 04:50 시작 → 05:10 종료 (리셋 05시를 가로지름)
            ZonedDateTime start = day.plusDays(1).atStartOfDay(SEOUL).plusHours(4).plusMinutes(50);

            // 경로 A: 8/15 요약(8/15 05:00 ~ 8/16 05:00)에 포함
            assertThat(includedInSummary(start, day)).isTrue();
            // 다음 날 요약에는 들어가면 안 된다 — 들어가면 이중 집계다
            assertThat(includedInSummary(start, day.plusDays(1))).isFalse();

            // 경로 B: 종료 시각(05:10) 기준으로 "지금"을 잡아도 어제 세션으로 본다
            ZonedDateTime now = day.plusDays(1).atStartOfDay(SEOUL).plusHours(5).plusMinutes(10);
            assertThat(isToday(start, now)).isFalse();
        }

        @Test
        @DisplayName("리셋 직후에 시작한 세션은 새 날에 귀속된다")
        void afterReset_belongsToNewDay() {
            LocalDate day = LocalDate.of(2026, 8, 15);
            ZonedDateTime start = day.plusDays(1).atStartOfDay(SEOUL).plusHours(5).plusMinutes(1);

            assertThat(includedInSummary(start, day.plusDays(1))).isTrue();

            ZonedDateTime now = start.plusMinutes(5);
            assertThat(isToday(start, now)).isTrue();
        }

        @Test
        @DisplayName("리셋 이전 시각에 조회해도 '오늘'은 전날 리셋부터다")
        void beforeReset_todayStartsAtPreviousReset() {
            LocalDate day = LocalDate.of(2026, 8, 16);
            // 지금이 03:00 (아직 05시 리셋 전) → 오늘은 8/15 05:00 부터
            ZonedDateTime now = day.atStartOfDay(SEOUL).plusHours(3);

            ZonedDateTime yesterdayEvening = day.minusDays(1).atStartOfDay(SEOUL).plusHours(23);
            assertThat(isToday(yesterdayEvening, now)).isTrue();

            ZonedDateTime beforeYesterdayReset = day.minusDays(1).atStartOfDay(SEOUL).plusHours(4);
            assertThat(isToday(beforeYesterdayReset, now)).isFalse();
        }
    }

    @Nested
    @DisplayName("두 경로의 일치성")
    class Consistency {

        @Test
        @DisplayName("리셋 정각에 시작한 세션을 두 경로가 같은 날로 귀속시킨다")
        void exactResetInstant_bothPathsAgree() {
            LocalDate day = LocalDate.of(2026, 8, 15);
            // 8/16 05:00:00 정각 — 8/15 구간의 끝이자 8/16 구간의 시작.
            // 어느 한쪽이라도 양끝 포함이면 같은 세션이 두 날에 동시에 잡힌다(이중 집계).
            ZonedDateTime exactReset = day.plusDays(1).atStartOfDay(SEOUL).plusHours(RESET_HOUR);

            ZonedDateTime now = exactReset.plusMinutes(1);

            assertThat(isToday(exactReset, now))
                    .as("경로 B: 반개구간이므로 새 날에 귀속")
                    .isTrue();
            assertThat(includedInSummary(exactReset, day))
                    .as("경로 A: 이전 날 구간의 끝은 배타적이어야 한다")
                    .isFalse();
            assertThat(includedInSummary(exactReset, day.plusDays(1)))
                    .as("경로 A: 새 날 구간의 시작은 포함이어야 한다")
                    .isTrue();
        }

        @Test
        @DisplayName("리셋 1밀리초 전 세션은 이전 날에만 귀속된다")
        void justBeforeReset_belongsOnlyToPreviousDay() {
            LocalDate day = LocalDate.of(2026, 8, 15);
            ZonedDateTime justBefore = day.plusDays(1).atStartOfDay(SEOUL)
                    .plusHours(RESET_HOUR).minusNanos(1_000_000);

            assertThat(includedInSummary(justBefore, day)).isTrue();
            assertThat(includedInSummary(justBefore, day.plusDays(1))).isFalse();

            ZonedDateTime now = justBefore.plusMinutes(10);
            assertThat(isToday(justBefore, now))
                    .as("리셋을 지난 시점에서 보면 어제 세션이다")
                    .isFalse();
        }
    }
}
