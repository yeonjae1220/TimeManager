package project.TimeManager.domain.tag.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import project.TimeManager.domain.member.model.MemberId;

import java.time.ZoneId;
import java.time.ZonedDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Tag 도메인 타이머 동작(start/stop/reset)")
class TagTimerTest {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final ZonedDateTime EPOCH =
            ZonedDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneId.systemDefault());
    private static final ZonedDateTime START =
            ZonedDateTime.of(2026, 6, 25, 10, 0, 0, 0, SEOUL);

    private Tag runningTag(ZonedDateTime latestStartTime, long elapsedTime) {
        return Tag.reconstitute(
                TagId.of(1L), "Ovlo", TagType.CUSTOM,
                elapsedTime, 0L, 0L, 0L, 0L, 0L,
                latestStartTime, EPOCH,
                TimerState.RUNNING, MemberId.of(1L), null);
    }

    private Tag stoppedTag(long elapsedTime) {
        return Tag.reconstitute(
                TagId.of(1L), "Ovlo", TagType.CUSTOM,
                elapsedTime, 0L, 0L, 0L, 0L, 0L,
                EPOCH, EPOCH,
                TimerState.STOPPED, MemberId.of(1L), null);
    }

    @Nested
    @DisplayName("reset")
    class Reset {

        @Test
        @DisplayName("실행 중인 타이머를 리셋하면 정지시키고, 시작 시각을 지우며, elapsedTime을 초기화한다(유령 러닝 방지)")
        void reset_running_stopsAndClearsStartTime() {
            // Arrange — 67시간 전에 시작되어 아직 RUNNING인 태그
            Tag tag = runningTag(START, 3600L);

            // Act
            tag.reset(0L);

            // Assert — 서버 상태가 실제로 정지되어야 신규 클라이언트(웹 등)에서 유령 러닝이 재현되지 않는다
            assertThat(tag.isRunning()).isFalse();
            assertThat(tag.getTimerState()).isEqualTo(TimerState.STOPPED);
            assertThat(tag.getElapsedTime()).isZero();
            assertThat(tag.getLatestStartTime()).isEqualTo(EPOCH);
        }

        @Test
        @DisplayName("정지 상태 태그를 리셋하면 정지 상태를 유지하고 elapsedTime만 초기화한다")
        void reset_stopped_staysStopped() {
            Tag tag = stoppedTag(5000L);

            tag.reset(0L);

            assertThat(tag.isRunning()).isFalse();
            assertThat(tag.getTimerState()).isEqualTo(TimerState.STOPPED);
            assertThat(tag.getElapsedTime()).isZero();
        }

        @Test
        @DisplayName("리셋은 전달된 elapsedTime 값으로 설정한다(0이 아닌 값도 허용)")
        void reset_setsGivenElapsedTime() {
            Tag tag = runningTag(START, 3600L);

            tag.reset(120L);

            assertThat(tag.getElapsedTime()).isEqualTo(120L);
            assertThat(tag.isRunning()).isFalse();
        }
    }

    @Nested
    @DisplayName("haltRunWithoutRecording (다중 RUNNING 화해)")
    class HaltRunWithoutRecording {

        @Test
        @DisplayName("정지시키고 기준 시작시각을 지우되, elapsedTime(누적)은 보존하고 기록은 만들지 않는다")
        void halt_stopsAndClearsStart_keepsElapsed() {
            // Arrange — 2시간 전 시작되어 아직 RUNNING인, 누적 3600초를 가진 태그
            Tag tag = runningTag(START, 3600L);

            // Act — 동시 start 레이스의 패자를 화해(정지)
            tag.haltRunWithoutRecording();

            // Assert — 권위 상태는 비우되(무상태 클라이언트 유령 러닝 방지) 누적은 날조 없이 보존
            assertThat(tag.isRunning()).isFalse();
            assertThat(tag.getTimerState()).isEqualTo(TimerState.STOPPED);
            assertThat(tag.getLatestStartTime()).isEqualTo(EPOCH);
            assertThat(tag.getElapsedTime()).isEqualTo(3600L);
        }
    }

    @Nested
    @DisplayName("start / stop")
    class StartStop {

        @Test
        @DisplayName("start는 RUNNING으로 만들고 시작 시각을 기록한다")
        void start_setsRunning() {
            Tag tag = stoppedTag(0L);

            tag.start(START);

            assertThat(tag.isRunning()).isTrue();
            assertThat(tag.getLatestStartTime()).isEqualTo(START);
        }

        @Test
        @DisplayName("stop은 STOPPED로 만들고 elapsedTime과 종료 시각을 기록한다")
        void stop_setsStopped() {
            Tag tag = runningTag(START, 0L);

            tag.stop(START.plusMinutes(10), 600L);

            assertThat(tag.isRunning()).isFalse();
            assertThat(tag.getTimerState()).isEqualTo(TimerState.STOPPED);
            assertThat(tag.getElapsedTime()).isEqualTo(600L);
            assertThat(tag.getLatestStopTime()).isEqualTo(START.plusMinutes(10));
        }
    }

    @Nested
    @DisplayName("EPOCH 센티넬 판정")
    class SentinelDetection {

        /**
         * "값 없음"은 null 이 아니라 1970-01-01 센티넬로 표현되는데, 그 절대시각은 그 값을
         * 쓴 쪽의 타임존에 따라 ±18시간 흔들린다. JVM 기본 타임존만 기준으로 삼으면 다른
         * 타임존에서 쓰인 센티넬이 "실제 시각"으로 통과해, 1970년부터의 거대한 구간이 만들어진다.
         */
        @Test
        @DisplayName("어느 타임존에서 쓴 센티넬이든 값 없음으로 판정한다")
        void treatsSentinelAsAbsent_regardlessOfWritingZone() {
            for (String zone : new String[]{"UTC", "Asia/Seoul", "America/Los_Angeles", "Pacific/Kiritimati", "Etc/GMT+12"}) {
                ZonedDateTime sentinel = ZonedDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneId.of(zone));
                Tag tag = Tag.reconstitute(
                        TagId.of(1L), "Ovlo", TagType.CUSTOM,
                        0L, 0L, 0L, 0L, 0L, 0L,
                        sentinel, sentinel,
                        TimerState.STOPPED, MemberId.of(1L), null);

                assertThat(tag.hasStartAnchor())
                        .as("%s 에서 쓴 센티넬이 실제 시작시각으로 통과했습니다", zone)
                        .isFalse();
                assertThat(tag.hasStopMark())
                        .as("%s 에서 쓴 센티넬이 실제 정지시각으로 통과했습니다", zone)
                        .isFalse();
            }
        }

        @Test
        @DisplayName("실제 시각은 값 있음으로 판정한다")
        void treatsRealInstantAsPresent() {
            Tag tag = Tag.reconstitute(
                    TagId.of(1L), "Ovlo", TagType.CUSTOM,
                    0L, 0L, 0L, 0L, 0L, 0L,
                    START, START.plusHours(1),
                    TimerState.RUNNING, MemberId.of(1L), null);

            assertThat(tag.hasStartAnchor()).isTrue();
            assertThat(tag.hasStopMark()).isTrue();
        }

        @Test
        @DisplayName("null 은 값 없음이다")
        void treatsNullAsAbsent() {
            Tag tag = Tag.reconstitute(
                    TagId.of(1L), "Ovlo", TagType.CUSTOM,
                    0L, 0L, 0L, 0L, 0L, 0L,
                    null, null,
                    TimerState.STOPPED, MemberId.of(1L), null);

            assertThat(tag.hasStartAnchor()).isFalse();
            assertThat(tag.hasStopMark()).isFalse();
        }
    }
}
