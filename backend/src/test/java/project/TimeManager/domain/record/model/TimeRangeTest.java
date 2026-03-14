package project.TimeManager.domain.record.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.ZoneId;
import java.time.ZonedDateTime;

import static org.assertj.core.api.Assertions.*;

@DisplayName("TimeRange")
class TimeRangeTest {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final ZonedDateTime BASE = ZonedDateTime.of(2024, 1, 1, 10, 0, 0, 0, SEOUL);

    @Nested
    @DisplayName("생성 시")
    class WhenCreating {

        @Test
        @DisplayName("start가 null이면 NullPointerException이 발생한다")
        void shouldThrow_whenStartIsNull() {
            assertThatNullPointerException()
                    .isThrownBy(() -> new TimeRange(null, BASE))
                    .withMessageContaining("시작 시간은 필수입니다");
        }

        @Test
        @DisplayName("end가 null이면 NullPointerException이 발생한다")
        void shouldThrow_whenEndIsNull() {
            assertThatNullPointerException()
                    .isThrownBy(() -> new TimeRange(BASE, null))
                    .withMessageContaining("종료 시간은 필수입니다");
        }

        @Test
        @DisplayName("end == start이면 IllegalArgumentException이 발생한다")
        void shouldThrow_whenEndEqualsStart() {
            assertThatIllegalArgumentException()
                    .isThrownBy(() -> new TimeRange(BASE, BASE))
                    .withMessageContaining("종료 시간은 시작 시간 이후여야 합니다");
        }

        @Test
        @DisplayName("end가 start 이전이면 IllegalArgumentException이 발생한다")
        void shouldThrow_whenEndBeforeStart() {
            ZonedDateTime end = BASE.minusSeconds(1);

            assertThatIllegalArgumentException()
                    .isThrownBy(() -> new TimeRange(BASE, end))
                    .withMessageContaining("종료 시간은 시작 시간 이후여야 합니다");
        }

        @Test
        @DisplayName("end가 start 이후이면 정상 생성된다")
        void shouldCreate_whenEndAfterStart() {
            ZonedDateTime end = BASE.plusHours(1);

            TimeRange range = new TimeRange(BASE, end);

            assertThat(range.start()).isEqualTo(BASE);
            assertThat(range.end()).isEqualTo(end);
        }
    }

    @Nested
    @DisplayName("durationInSeconds")
    class WhenCalculatingDuration {

        @Test
        @DisplayName("1시간 구간이면 3600초를 반환한다")
        void shouldReturn3600_forOneHour() {
            TimeRange range = new TimeRange(BASE, BASE.plusHours(1));

            assertThat(range.durationInSeconds()).isEqualTo(3600L);
        }

        @Test
        @DisplayName("30분 구간이면 1800초를 반환한다")
        void shouldReturn1800_forThirtyMinutes() {
            TimeRange range = new TimeRange(BASE, BASE.plusMinutes(30));

            assertThat(range.durationInSeconds()).isEqualTo(1800L);
        }

        @Test
        @DisplayName("1초 구간이면 1초를 반환한다")
        void shouldReturn1_forOneSecond() {
            TimeRange range = new TimeRange(BASE, BASE.plusSeconds(1));

            assertThat(range.durationInSeconds()).isEqualTo(1L);
        }
    }

    @Nested
    @DisplayName("withStart / withEnd 변환")
    class WhenMutating {

        @Test
        @DisplayName("withStart는 start만 교체한 새 TimeRange를 반환한다")
        void withStart_shouldReplaceStart() {
            TimeRange original = new TimeRange(BASE, BASE.plusHours(2));
            ZonedDateTime newStart = BASE.plusMinutes(30);

            TimeRange updated = original.withStart(newStart);

            assertThat(updated.start()).isEqualTo(newStart);
            assertThat(updated.end()).isEqualTo(original.end());
        }

        @Test
        @DisplayName("withEnd는 end만 교체한 새 TimeRange를 반환한다")
        void withEnd_shouldReplaceEnd() {
            TimeRange original = new TimeRange(BASE, BASE.plusHours(2));
            ZonedDateTime newEnd = BASE.plusHours(3);

            TimeRange updated = original.withEnd(newEnd);

            assertThat(updated.start()).isEqualTo(original.start());
            assertThat(updated.end()).isEqualTo(newEnd);
        }

        @Test
        @DisplayName("withStart에 end 이후 시간을 지정하면 예외가 발생한다")
        void withStart_shouldThrow_whenNewStartAfterEnd() {
            TimeRange original = new TimeRange(BASE, BASE.plusHours(1));

            assertThatIllegalArgumentException()
                    .isThrownBy(() -> original.withStart(BASE.plusHours(2)));
        }
    }
}
