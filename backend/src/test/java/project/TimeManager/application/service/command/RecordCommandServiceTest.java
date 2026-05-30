package project.TimeManager.application.service.command;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import project.TimeManager.application.dto.command.CreateRecordCommand;
import project.TimeManager.application.dto.command.EditRecordTimeCommand;
import project.TimeManager.application.dto.result.RecordResult;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.exception.RecordOverlapException;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.port.out.record.FindOverlappingRecordsPort;
import project.TimeManager.domain.port.out.record.FindOverlappingRecordsPort.OverlapResult;
import project.TimeManager.domain.port.out.record.LoadRecordPort;
import project.TimeManager.domain.port.out.record.LoadRecordsByTagPort;
import project.TimeManager.domain.port.out.record.SaveRecordPort;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.port.out.member.LoadMemberPort;
import project.TimeManager.domain.port.out.tag.LoadTagPort;
import project.TimeManager.domain.port.out.tag.SaveTagPort;
import project.TimeManager.domain.port.out.tag.UpdateTagTimeBatchPort;
import project.TimeManager.domain.record.model.Record;
import project.TimeManager.domain.record.model.RecordId;
import project.TimeManager.domain.record.model.TimeRange;
import project.TimeManager.domain.tag.model.Tag;
import project.TimeManager.domain.tag.model.TagId;
import project.TimeManager.domain.tag.model.TagType;
import project.TimeManager.domain.tag.model.TimerState;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("RecordCommandService")
class RecordCommandServiceTest {

    @Mock LoadTagPort loadTagPort;
    @Mock SaveTagPort saveTagPort;
    @Mock LoadRecordPort loadRecordPort;
    @Mock LoadRecordsByTagPort loadRecordsByTagPort;
    @Mock SaveRecordPort saveRecordPort;
    @Mock UpdateTagTimeBatchPort updateTagTimeBatchPort;
    @Mock FindOverlappingRecordsPort findOverlappingRecordsPort;
    @Mock LoadMemberPort loadMemberPort;

    RecordCommandService recordCommandService;

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final ZonedDateTime START = ZonedDateTime.of(2024, 1, 1, 10, 0, 0, 0, SEOUL);
    private static final ZonedDateTime END   = ZonedDateTime.of(2024, 1, 1, 11, 0, 0, 0, SEOUL); // 3600초

    private Tag stubTag(Long tagId) {
        return Tag.reconstitute(
                TagId.of(tagId), "TestTag", TagType.CUSTOM,
                0L, 0L, 0L, 0L, 0L, 0L,
                ZonedDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneId.systemDefault()),
                ZonedDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneId.systemDefault()),
                TimerState.STOPPED,
                MemberId.of(1L), null);
    }

    private RecordResult stubRecordResult(Long recordId, ZonedDateTime start, ZonedDateTime end, Long totalTime) {
        return new RecordResult(recordId, start, end, totalTime, 1L);
    }

    private void setUpSyncDefaults(Long tagId, ZonedDateTime start, ZonedDateTime end, Long totalTime) {
        given(loadRecordsByTagPort.loadRecordsByTagId(tagId))
                .willReturn(List.of(stubRecordResult(1L, start, end, totalTime)));
    }

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        given(loadMemberPort.loadMember(1L)).willReturn(Optional.of(
                Member.reconstitute(MemberId.of(1L), "TestUser", "test@test.com", "hashed", null, null, null, null, 5, null)));
        TagRecordDerivedFieldsSyncService syncService =
                new TagRecordDerivedFieldsSyncService(loadTagPort, loadRecordsByTagPort, saveTagPort, loadMemberPort);
        recordCommandService = new RecordCommandService(
                loadTagPort,
                loadRecordPort,
                saveRecordPort,
                updateTagTimeBatchPort,
                findOverlappingRecordsPort,
                syncService
        );
    }

    @Nested
    @DisplayName("createRecord")
    class WhenCreatingRecord {

        @Test
        @DisplayName("정상 요청 시 레코드를 저장하고 id를 반환한다")
        void shouldSaveRecordAndReturnId() {
            // Arrange
            Long tagId = 1L;
            Tag tag = stubTag(tagId);
            given(loadTagPort.loadTag(tagId)).willReturn(Optional.of(tag));
            given(saveRecordPort.saveRecord(any())).willReturn(100L);
            setUpSyncDefaults(tagId, START, END, 3600L);

            CreateRecordCommand command = new CreateRecordCommand(tagId, START, END, false);

            // Act
            Long recordId = recordCommandService.createRecord(command);

            // Assert
            assertThat(recordId).isEqualTo(100L);
            then(saveTagPort).should().saveTag(tag);
            then(updateTagTimeBatchPort).should().updateTagTimeBatch(eq(tagId), eq(3600L));
        }

        @Test
        @DisplayName("존재하지 않는 tagId로 요청하면 DomainException이 발생한다")
        void shouldThrowDomainException_whenTagNotFound() {
            given(loadTagPort.loadTag(anyLong())).willReturn(Optional.empty());

            CreateRecordCommand command = new CreateRecordCommand(999L, START, END, false);

            assertThatThrownBy(() -> recordCommandService.createRecord(command))
                    .isInstanceOf(DomainException.class)
                    .hasMessageContaining("Tag not found");
        }

        @Test
        @DisplayName("레코드 생성 시 태그의 tagTotalTime이 증가한다")
        void shouldIncreaseTagTotalTime_afterCreate() {
            Long tagId = 1L;
            Tag tag = stubTag(tagId);
            given(loadTagPort.loadTag(tagId)).willReturn(Optional.of(tag));
            given(saveRecordPort.saveRecord(any())).willReturn(1L);
            setUpSyncDefaults(tagId, START, END, 3600L);

            recordCommandService.createRecord(new CreateRecordCommand(tagId, START, END, false));

            assertThat(tag.getTagTotalTime()).isEqualTo(3600L);
        }
    }

    @Nested
    @DisplayName("editRecordTime")
    class WhenEditingRecordTime {

        @Test
        @DisplayName("시간 범위가 확장되면 delta만큼 배치 업데이트가 호출된다")
        void shouldCallBatchUpdate_withPositiveDelta() {
            Long recordId = 10L;
            TagId tagId = TagId.of(1L);
            TimeRange originalRange = new TimeRange(START, END); // 3600초
            Record record = Record.reconstitute(RecordId.of(recordId), tagId, originalRange, 3600L);

            given(loadRecordPort.loadRecord(recordId)).willReturn(Optional.of(record));
            given(loadTagPort.loadTag(tagId.value())).willReturn(Optional.of(stubTag(tagId.value())));
            given(loadRecordsByTagPort.loadRecordsByTagId(tagId.value()))
                    .willReturn(List.of(stubRecordResult(recordId, START, END.plusHours(1), 7200L)));

            ZonedDateTime newEnd = END.plusHours(1); // 7200초
            EditRecordTimeCommand command = new EditRecordTimeCommand(recordId, START, newEnd, 1L, false, null);

            recordCommandService.editRecordTime(command);

            then(updateTagTimeBatchPort).should().updateTagTimeBatch(eq(tagId.value()), eq(3600L)); // delta = 7200 - 3600
        }

        @Test
        @DisplayName("시간 범위가 동일하면 배치 업데이트가 호출되지 않는다")
        void shouldNotCallBatchUpdate_whenDeltaIsZero() {
            Long recordId = 10L;
            TagId tagId = TagId.of(1L);
            TimeRange originalRange = new TimeRange(START, END);
            Record record = Record.reconstitute(RecordId.of(recordId), tagId, originalRange, 3600L);

            given(loadRecordPort.loadRecord(recordId)).willReturn(Optional.of(record));
            given(loadTagPort.loadTag(tagId.value())).willReturn(Optional.of(stubTag(tagId.value())));
            given(loadRecordsByTagPort.loadRecordsByTagId(tagId.value()))
                    .willReturn(List.of(stubRecordResult(recordId, START, END, 3600L)));

            // 동일한 시간 범위로 수정
            EditRecordTimeCommand command = new EditRecordTimeCommand(recordId, START, END, 1L, false, null);

            recordCommandService.editRecordTime(command);

            then(updateTagTimeBatchPort).shouldHaveNoInteractions();
        }

        @Test
        @DisplayName("존재하지 않는 recordId이면 DomainException이 발생한다")
        void shouldThrow_whenRecordNotFound() {
            given(loadRecordPort.loadRecord(anyLong())).willReturn(Optional.empty());

            EditRecordTimeCommand command = new EditRecordTimeCommand(999L, START, END, 1L, false, null);

            assertThatThrownBy(() -> recordCommandService.editRecordTime(command))
                    .isInstanceOf(DomainException.class)
                    .hasMessageContaining("Record not found");
        }

        @Test
        @DisplayName("newTagId가 다르면 oldTag에서 차감 newTag에 가산된다")
        void shouldMoveRecord_whenNewTagIdDiffers() {
            Long recordId = 10L;
            Long oldTagIdVal = 1L;
            Long newTagIdVal = 2L;
            TagId tagId = TagId.of(oldTagIdVal);
            TimeRange originalRange = new TimeRange(START, END); // 3600초
            Record record = Record.reconstitute(RecordId.of(recordId), tagId, originalRange, 3600L);

            given(loadRecordPort.loadRecord(recordId)).willReturn(Optional.of(record));
            given(loadTagPort.loadTag(oldTagIdVal)).willReturn(Optional.of(stubTag(oldTagIdVal)));
            given(loadTagPort.loadTag(newTagIdVal)).willReturn(Optional.of(stubTag(newTagIdVal)));
            given(loadRecordsByTagPort.loadRecordsByTagId(oldTagIdVal)).willReturn(List.of());
            given(loadRecordsByTagPort.loadRecordsByTagId(newTagIdVal)).willReturn(List.of());

            EditRecordTimeCommand command = new EditRecordTimeCommand(recordId, START, END, 1L, false, newTagIdVal);

            recordCommandService.editRecordTime(command);

            then(updateTagTimeBatchPort).should().updateTagTimeBatch(eq(oldTagIdVal), eq(-3600L));
            then(updateTagTimeBatchPort).should().updateTagTimeBatch(eq(newTagIdVal), eq(3600L));
        }

        @Test
        @DisplayName("newTagId가 null이면 기존 태그에 delta만 반영된다")
        void shouldKeepTag_whenNewTagIdIsNull() {
            Long recordId = 10L;
            TagId tagId = TagId.of(1L);
            TimeRange originalRange = new TimeRange(START, END); // 3600초
            Record record = Record.reconstitute(RecordId.of(recordId), tagId, originalRange, 3600L);

            given(loadRecordPort.loadRecord(recordId)).willReturn(Optional.of(record));
            given(loadTagPort.loadTag(1L)).willReturn(Optional.of(stubTag(1L)));
            given(loadRecordsByTagPort.loadRecordsByTagId(1L))
                    .willReturn(List.of(stubRecordResult(recordId, START, END.plusHours(1), 7200L)));

            ZonedDateTime newEnd = END.plusHours(1);
            EditRecordTimeCommand command = new EditRecordTimeCommand(recordId, START, newEnd, 1L, false, null);

            recordCommandService.editRecordTime(command);

            then(updateTagTimeBatchPort).should().updateTagTimeBatch(eq(1L), eq(3600L));
            then(updateTagTimeBatchPort).shouldHaveNoMoreInteractions();
        }

        @Test
        @DisplayName("다른 멤버의 태그로 변경하면 DomainException이 발생한다")
        void shouldThrow_whenNewTagBelongsToOtherMember() {
            Long recordId = 10L;
            TagId tagId = TagId.of(1L);
            Record record = Record.reconstitute(RecordId.of(recordId), tagId, new TimeRange(START, END), 3600L);

            Tag otherMemberTag = Tag.reconstitute(
                    TagId.of(2L), "OtherTag", TagType.CUSTOM,
                    0L, 0L, 0L, 0L, 0L, 0L,
                    ZonedDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneId.systemDefault()),
                    ZonedDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneId.systemDefault()),
                    TimerState.STOPPED,
                    MemberId.of(99L), null);

            given(loadRecordPort.loadRecord(recordId)).willReturn(Optional.of(record));
            given(loadTagPort.loadTag(1L)).willReturn(Optional.of(stubTag(1L)));
            given(loadTagPort.loadTag(2L)).willReturn(Optional.of(otherMemberTag));

            EditRecordTimeCommand command = new EditRecordTimeCommand(recordId, START, END, 1L, false, 2L);

            assertThatThrownBy(() -> recordCommandService.editRecordTime(command))
                    .isInstanceOf(DomainException.class)
                    .hasMessageContaining("접근 권한이 없습니다");
        }
    }

    @Nested
    @DisplayName("시간 중복 처리")
    class WhenOverlapDetected {

        @Test
        @DisplayName("createRecord — 중복 있고 forceOverwrite=false 이면 RecordOverlapException이 발생한다")
        void createRecord_shouldThrow_whenOverlapExists_andNotForced() {
            Long tagId = 1L;
            Tag tag = stubTag(tagId);
            given(loadTagPort.loadTag(tagId)).willReturn(Optional.of(tag));

            OverlapResult overlap = new OverlapResult(99L, 2L, "Other", START, END);
            given(findOverlappingRecordsPort.findOverlappingRecords(any(), any(), any(), isNull()))
                    .willReturn(List.of(overlap));

            CreateRecordCommand command = new CreateRecordCommand(tagId, START, END, false);

            assertThatThrownBy(() -> recordCommandService.createRecord(command))
                    .isInstanceOf(RecordOverlapException.class);

            then(saveRecordPort).shouldHaveNoInteractions();
        }

        @Test
        @DisplayName("createRecord — 중복 있고 forceOverwrite=true 이면 겹치는 레코드를 삭제하고 저장한다")
        void createRecord_shouldDeleteOverlapsAndSave_whenForced() {
            Long tagId = 1L;
            Long overlapTagId = 2L;
            Tag tag = stubTag(tagId);

            given(loadTagPort.loadTag(tagId)).willReturn(Optional.of(tag));
            given(saveRecordPort.saveRecord(any())).willReturn(100L);
            setUpSyncDefaults(tagId, START, END, 3600L);

            OverlapResult overlapResult = new OverlapResult(99L, overlapTagId, "Other", START, END);
            given(findOverlappingRecordsPort.findOverlappingRecords(any(), any(), any(), isNull()))
                    .willReturn(List.of(overlapResult));

            Record overlapRecord = Record.reconstitute(RecordId.of(99L), TagId.of(overlapTagId), new TimeRange(START, END), 3600L);
            given(loadRecordPort.loadRecord(99L)).willReturn(Optional.of(overlapRecord));
            given(loadTagPort.loadTag(overlapTagId)).willReturn(Optional.of(stubTag(overlapTagId)));
            given(loadRecordsByTagPort.loadRecordsByTagId(overlapTagId)).willReturn(List.of());

            CreateRecordCommand command = new CreateRecordCommand(tagId, START, END, true);

            Long recordId = recordCommandService.createRecord(command);

            assertThat(recordId).isEqualTo(100L);
            then(saveRecordPort).should().deleteRecord(99L);
            then(updateTagTimeBatchPort).should().updateTagTimeBatch(eq(overlapTagId), eq(-3600L));
        }

        @Test
        @DisplayName("editRecordTime — 자기 자신의 시간대로 수정해도 중복 예외가 발생하지 않는다")
        void editRecord_shouldNotThrow_whenOnlySelfOverlap() {
            Long recordId = 10L;
            TagId tagId = TagId.of(1L);
            TimeRange originalRange = new TimeRange(START, END);
            Record record = Record.reconstitute(RecordId.of(recordId), tagId, originalRange, 3600L);

            given(loadRecordPort.loadRecord(recordId)).willReturn(Optional.of(record));
            given(loadTagPort.loadTag(tagId.value())).willReturn(Optional.of(stubTag(tagId.value())));
            given(loadRecordsByTagPort.loadRecordsByTagId(tagId.value()))
                    .willReturn(List.of(stubRecordResult(recordId, START, END, 3600L)));
            // excludeRecordId=recordId 로 쿼리 시 빈 목록 반환 (자기 제외)
            given(findOverlappingRecordsPort.findOverlappingRecords(any(), any(), any(), eq(recordId)))
                    .willReturn(List.of());

            EditRecordTimeCommand command = new EditRecordTimeCommand(recordId, START, END, 1L, false, null);

            assertThatNoException().isThrownBy(() -> recordCommandService.editRecordTime(command));
        }

        @Test
        @DisplayName("editRecordTime — 다른 기록과 겹치고 forceOverwrite=false 이면 RecordOverlapException이 발생한다")
        void editRecord_shouldThrow_whenOverlapWithOtherRecord_andNotForced() {
            Long recordId = 10L;
            TagId tagId = TagId.of(1L);
            Record record = Record.reconstitute(RecordId.of(recordId), tagId, new TimeRange(START, END), 3600L);

            given(loadRecordPort.loadRecord(recordId)).willReturn(Optional.of(record));
            given(loadTagPort.loadTag(tagId.value())).willReturn(Optional.of(stubTag(tagId.value())));

            OverlapResult overlap = new OverlapResult(50L, 2L, "Other", START, END);
            given(findOverlappingRecordsPort.findOverlappingRecords(any(), any(), any(), eq(recordId)))
                    .willReturn(List.of(overlap));

            EditRecordTimeCommand command = new EditRecordTimeCommand(recordId, START, END.plusHours(1), 1L, false, null);

            assertThatThrownBy(() -> recordCommandService.editRecordTime(command))
                    .isInstanceOf(RecordOverlapException.class);
        }
    }

    @Nested
    @DisplayName("deleteRecord")
    class WhenDeletingRecord {

        @Test
        @DisplayName("레코드가 존재하면 삭제 후 true를 반환한다")
        void shouldReturnTrue_whenRecordExists() {
            Long recordId = 10L;
            TagId tagId = TagId.of(1L);
            Record record = Record.reconstitute(RecordId.of(recordId), tagId, new TimeRange(START, END), 3600L);
            given(loadRecordPort.loadRecord(recordId)).willReturn(Optional.of(record));
            given(loadTagPort.loadTag(tagId.value())).willReturn(Optional.of(stubTag(tagId.value())));
            given(loadRecordsByTagPort.loadRecordsByTagId(tagId.value())).willReturn(List.of());

            boolean result = recordCommandService.deleteRecord(recordId, 1L);

            assertThat(result).isTrue();
            then(saveRecordPort).should().deleteRecord(recordId);
            then(updateTagTimeBatchPort).should().updateTagTimeBatch(eq(tagId.value()), eq(-3600L));
        }

        @Test
        @DisplayName("레코드가 없으면 false를 반환하고 삭제 호출이 없다")
        void shouldReturnFalse_whenRecordNotFound() {
            given(loadRecordPort.loadRecord(anyLong())).willReturn(Optional.empty());

            boolean result = recordCommandService.deleteRecord(999L, 1L);

            assertThat(result).isFalse();
            then(saveRecordPort).shouldHaveNoInteractions();
            then(updateTagTimeBatchPort).shouldHaveNoInteractions();
        }
    }
}
