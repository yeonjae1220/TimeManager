package project.TimeManager.application.service.command;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import project.TimeManager.application.dto.result.RecordResult;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.port.out.member.LoadMemberPort;
import project.TimeManager.domain.port.out.record.LoadRecordsByTagPort;
import project.TimeManager.domain.port.out.tag.LoadTagPort;
import project.TimeManager.domain.port.out.tag.SaveTagPort;
import project.TimeManager.domain.tag.model.Tag;
import project.TimeManager.domain.tag.model.TagId;
import project.TimeManager.domain.tag.model.TagType;
import project.TimeManager.domain.tag.model.TimerState;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("TagRecordDerivedFieldsSyncService")
class TagRecordDerivedFieldsSyncServiceTest {

    @Mock LoadTagPort loadTagPort;
    @Mock LoadRecordsByTagPort loadRecordsByTagPort;
    @Mock SaveTagPort saveTagPort;
    @Mock LoadMemberPort loadMemberPort;

    @InjectMocks TagRecordDerivedFieldsSyncService service;

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final ZonedDateTime EPOCH =
            ZonedDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneId.systemDefault());

    private Tag stoppedTag(ZonedDateTime latestStartTime, ZonedDateTime latestStopTime) {
        return Tag.reconstitute(
                TagId.of(10L), "빅분기", TagType.CUSTOM,
                0L, 0L, 0L, 0L, 0L, 0L,
                latestStartTime, latestStopTime,
                TimerState.STOPPED, MemberId.of(1L), null);
    }

    private void givenMemberAndTag(Tag tag) {
        given(loadTagPort.loadTag(10L)).willReturn(Optional.of(tag));
        given(loadMemberPort.loadMember(1L)).willReturn(Optional.of(Member.reconstitute(
                MemberId.of(1L), "tester", "t@example.com", null,
                null, null, null, "Asia/Seoul", 0, null)));
    }

    @Test
    @DisplayName("마지막 기록을 지워도 타이머의 정지시각(latestStopTime)은 뒤로 돌아가지 않는다")
    void sync_doesNotRewindLatestStopTime_whenLastRecordDeleted() {
        // Arrange — PWA 가 12:20 에 정지시켜 latestStopTime 이 찍혔고, 그 기록을 방금 삭제해
        // 이 태그에 남은 기록이 없는 상태.
        ZonedDateTime stoppedAt = ZonedDateTime.of(2026, 9, 5, 12, 20, 0, 0, SEOUL);
        Tag tag = stoppedTag(ZonedDateTime.of(2026, 9, 5, 2, 13, 0, 0, SEOUL), stoppedAt);
        givenMemberAndTag(tag);
        given(loadRecordsByTagPort.loadRecordsByTagId(10L)).willReturn(List.of());

        // Act
        service.sync(10L);

        // Assert — 정지 사실이 지워지면 다른 기기의 로컬 스냅샷이 서버를 이겨 유령 러닝이 부활한다.
        assertThat(tag.getLatestStopTime())
                .as("기록 삭제가 정지시각을 EPOCH 로 되돌리면 안 된다")
                .isEqualTo(stoppedAt);
    }

    @Test
    @DisplayName("남은 기록이 더 오래된 것뿐이어도 정지시각은 뒤로 돌아가지 않는다")
    void sync_doesNotRewindLatestStopTime_toOlderRemainingRecord() {
        // Arrange — 어제 기록만 남고 오늘 세션 기록이 지워진 경우.
        ZonedDateTime stoppedAt = ZonedDateTime.of(2026, 9, 5, 12, 20, 0, 0, SEOUL);
        ZonedDateTime yesterdayEnd = ZonedDateTime.of(2026, 9, 4, 18, 0, 0, 0, SEOUL);
        Tag tag = stoppedTag(ZonedDateTime.of(2026, 9, 5, 2, 13, 0, 0, SEOUL), stoppedAt);
        givenMemberAndTag(tag);
        given(loadRecordsByTagPort.loadRecordsByTagId(10L)).willReturn(List.of(
                new RecordResult(1L, yesterdayEnd.minusHours(1), yesterdayEnd, 3600L, 10L)));

        // Act
        service.sync(10L);

        // Assert
        assertThat(tag.getLatestStopTime())
                .as("남은 기록이 더 오래됐으면 그 값으로 후퇴하면 안 된다")
                .isEqualTo(stoppedAt);
    }

    @Test
    @DisplayName("나중 시각의 기록이 추가되면 정지시각은 그 값으로 전진한다")
    void sync_advancesLatestStopTime_whenNewerRecordExists() {
        // Arrange — 수동으로 더 나중 구간의 기록을 추가한 경우.
        ZonedDateTime stoppedAt = ZonedDateTime.of(2026, 9, 5, 12, 20, 0, 0, SEOUL);
        ZonedDateTime newerEnd = ZonedDateTime.of(2026, 9, 5, 15, 0, 0, 0, SEOUL);
        Tag tag = stoppedTag(ZonedDateTime.of(2026, 9, 5, 2, 13, 0, 0, SEOUL), stoppedAt);
        givenMemberAndTag(tag);
        given(loadRecordsByTagPort.loadRecordsByTagId(10L)).willReturn(List.of(
                new RecordResult(1L, newerEnd.minusHours(1), newerEnd, 3600L, 10L)));

        // Act
        service.sync(10L);

        // Assert
        assertThat(tag.getLatestStopTime())
                .as("전진은 막지 않는다 — 단조 증가여야 한다")
                .isEqualTo(newerEnd);
    }

    @Test
    @DisplayName("정지시각이 없던 태그(EPOCH)는 기록 시각으로 채워진다")
    void sync_fillsLatestStopTime_whenTagNeverStopped() {
        // Arrange — 타이머를 쓴 적 없이 수동 기록만 추가한 태그.
        ZonedDateTime recordEnd = ZonedDateTime.of(2026, 9, 5, 15, 0, 0, 0, SEOUL);
        Tag tag = stoppedTag(EPOCH, EPOCH);
        givenMemberAndTag(tag);
        given(loadRecordsByTagPort.loadRecordsByTagId(10L)).willReturn(List.of(
                new RecordResult(1L, recordEnd.minusHours(1), recordEnd, 3600L, 10L)));

        // Act
        service.sync(10L);

        // Assert
        assertThat(tag.getLatestStopTime()).isEqualTo(recordEnd);
    }

    @Test
    @DisplayName("누적 시간은 기록으로부터 그대로 재계산된다(기존 동작 유지)")
    void sync_stillRecomputesTotalsFromRecords() {
        // Arrange
        ZonedDateTime end = ZonedDateTime.now(SEOUL).minusHours(2);
        Tag tag = stoppedTag(EPOCH, EPOCH);
        givenMemberAndTag(tag);
        given(loadRecordsByTagPort.loadRecordsByTagId(10L)).willReturn(List.of(
                new RecordResult(1L, end.minusHours(1), end, 3600L, 10L),
                new RecordResult(2L, end.minusHours(3), end.minusHours(2), 3600L, 10L)));

        // Act
        service.sync(10L);

        // Assert
        assertThat(tag.getTagTotalTime()).isEqualTo(7200L);
    }
}
