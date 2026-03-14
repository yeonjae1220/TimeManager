package project.TimeManager.domain.record.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import project.TimeManager.domain.tag.model.TagId;

import java.time.ZoneId;
import java.time.ZonedDateTime;

import static org.assertj.core.api.Assertions.*;

@DisplayName("Record 도메인")
class RecordDomainTest {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final ZonedDateTime START = ZonedDateTime.of(2024, 1, 1, 10, 0, 0, 0, SEOUL);
    private static final ZonedDateTime END   = ZonedDateTime.of(2024, 1, 1, 11, 0, 0, 0, SEOUL); // 3600초
    private static final TagId TAG_ID = TagId.of(1L);

    @Nested
    @DisplayName("Record.create")
    class WhenCreating {

        @Test
        @DisplayName("생성 시 totalTime은 TimeRange의 durationInSeconds와 같다")
        void shouldSetTotalTime_equalToDuration() {
            TimeRange timeRange = new TimeRange(START, END);

            Record record = Record.create(TAG_ID, timeRange);

            assertThat(record.getTotalTime()).isEqualTo(3600L);
        }

        @Test
        @DisplayName("생성 시 tagId가 올바르게 설정된다")
        void shouldSetTagId() {
            TimeRange timeRange = new TimeRange(START, END);

            Record record = Record.create(TAG_ID, timeRange);

            assertThat(record.getTagId()).isEqualTo(TAG_ID);
        }

        @Test
        @DisplayName("새로 생성된 레코드의 id는 null이다")
        void shouldHaveNullId_whenNewlyCreated() {
            Record record = Record.create(TAG_ID, new TimeRange(START, END));

            assertThat(record.getId()).isNull();
        }
    }

    @Nested
    @DisplayName("editTimeRange")
    class WhenEditingTimeRange {

        @Test
        @DisplayName("시간 범위 수정 시 totalTime이 새 범위의 duration으로 업데이트된다")
        void shouldUpdateTotalTime_afterEdit() {
            Record record = Record.create(TAG_ID, new TimeRange(START, END)); // 3600초
            TimeRange newRange = new TimeRange(START, START.plusMinutes(30)); // 1800초

            record.editTimeRange(newRange);

            assertThat(record.getTotalTime()).isEqualTo(1800L);
        }

        @Test
        @DisplayName("시간 범위 수정 시 timeRange가 교체된다")
        void shouldReplaceTimeRange_afterEdit() {
            Record record = Record.create(TAG_ID, new TimeRange(START, END));
            TimeRange newRange = new TimeRange(START.plusHours(1), START.plusHours(3));

            record.editTimeRange(newRange);

            assertThat(record.getTimeRange()).isEqualTo(newRange);
        }
    }

    @Nested
    @DisplayName("moveToTag")
    class WhenMovingToTag {

        @Test
        @DisplayName("다른 tagId로 이동하면 tagId가 변경된다")
        void shouldChangeTagId_afterMove() {
            Record record = Record.create(TAG_ID, new TimeRange(START, END));
            TagId newTagId = TagId.of(99L);

            record.moveToTag(newTagId);

            assertThat(record.getTagId()).isEqualTo(newTagId);
        }
    }

    @Nested
    @DisplayName("Record.reconstitute")
    class WhenReconstituting {

        @Test
        @DisplayName("복원 시 모든 필드가 설정된다")
        void shouldSetAllFields() {
            RecordId recordId = RecordId.of(10L);
            TimeRange timeRange = new TimeRange(START, END);

            Record record = Record.reconstitute(recordId, TAG_ID, timeRange, 3600L);

            assertThat(record.getId()).isEqualTo(recordId);
            assertThat(record.getTagId()).isEqualTo(TAG_ID);
            assertThat(record.getTimeRange()).isEqualTo(timeRange);
            assertThat(record.getTotalTime()).isEqualTo(3600L);
        }
    }
}
