package project.TimeManager.application.service.query;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import project.TimeManager.adapter.out.persistence.entity.RecordJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.application.dto.result.RecordSummaryResult;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.member.model.MemberRole;
import project.TimeManager.domain.member.model.OAuthProvider;
import project.TimeManager.domain.port.out.member.LoadMemberPort;
import project.TimeManager.domain.port.out.record.LoadRecordsByMemberPort;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@DisplayName("RecordSummaryService")
class RecordSummaryServiceTest {

    @Mock
    LoadRecordsByMemberPort loadRecordsByMemberPort;

    @Mock
    LoadMemberPort loadMemberPort;

    @Captor
    ArgumentCaptor<ZonedDateTime> startCaptor;

    @Captor
    ArgumentCaptor<ZonedDateTime> endCaptor;

    RecordSummaryService recordSummaryService;

    private static final Long MEMBER_ID = 1L;
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    private Member memberWithResetHour(int resetHour) {
        return Member.reconstitute(
                MemberId.of(MEMBER_ID), "tester", "tester@example.com", "hashed",
                OAuthProvider.LOCAL, null, MemberRole.MEMBER,
                "Asia/Seoul", resetHour, LocalDateTime.now());
    }

    private TagJpaEntity stubTag(Long tagId, String name) {
        TagJpaEntity tag = new TagJpaEntity();
        tag.setId(tagId);
        tag.setName(name);
        return tag;
    }

    @Test
    @DisplayName("dailyResetHour=5인 회원의 '오늘' 경계는 UTC 자정이 아니라 한국시간 05:00 기준이다")
    void getSummary_usesDailyResetHour_notUtcMidnight() {
        recordSummaryService = new RecordSummaryService(loadRecordsByMemberPort, loadMemberPort);
        given(loadMemberPort.loadMember(MEMBER_ID)).willReturn(Optional.of(memberWithResetHour(5)));
        given(loadRecordsByMemberPort.loadRecordsByMemberAndDateRange(eq(MEMBER_ID), any(), any()))
                .willReturn(List.of());

        LocalDate today = LocalDate.of(2026, 7, 5);
        recordSummaryService.getSummary(MEMBER_ID, today, today);

        verify(loadRecordsByMemberPort).loadRecordsByMemberAndDateRange(
                eq(MEMBER_ID), startCaptor.capture(), endCaptor.capture());

        ZonedDateTime expectedStart = ZonedDateTime.of(2026, 7, 5, 5, 0, 0, 0, SEOUL);
        ZonedDateTime expectedEnd = ZonedDateTime.of(2026, 7, 6, 5, 0, 0, 0, SEOUL);

        assertThat(startCaptor.getValue()).isEqualTo(expectedStart);
        assertThat(endCaptor.getValue()).isEqualTo(expectedEnd);
    }

    @Test
    @DisplayName("새벽 5시~9시(KST) 사이 시작한 기록도 오늘 합계에 포함된다 (resetHour=5)")
    void getSummary_includesEarlyMorningRecord_withinResetWindow() {
        recordSummaryService = new RecordSummaryService(loadRecordsByMemberPort, loadMemberPort);
        given(loadMemberPort.loadMember(MEMBER_ID)).willReturn(Optional.of(memberWithResetHour(5)));

        // KST 07:00 시작 — UTC 자정 기준이었다면 "전날"로 취급돼 누락됐을 시각.
        ZonedDateTime start = ZonedDateTime.of(2026, 7, 5, 7, 0, 0, 0, SEOUL);
        ZonedDateTime end = ZonedDateTime.of(2026, 7, 5, 7, 30, 0, 0, SEOUL);
        RecordJpaEntity record = new RecordJpaEntity(stubTag(10L, "Study"), start, end);

        given(loadRecordsByMemberPort.loadRecordsByMemberAndDateRange(eq(MEMBER_ID), any(), any()))
                .willReturn(List.of(record));

        LocalDate today = LocalDate.of(2026, 7, 5);
        RecordSummaryResult result = recordSummaryService.getSummary(MEMBER_ID, today, today);

        assertThat(result.getTotalSeconds()).isEqualTo(1800L);
        assertThat(result.getTagSummaries()).hasSize(1);
    }

    @Test
    @DisplayName("같은 회원의 반복 조회(Logs 주/월 뷰의 병렬 summary 호출)는 Member를 한 번만 조회한다")
    void getSummary_repeatedCallsForSameMember_loadMemberOnlyOnce() {
        recordSummaryService = new RecordSummaryService(loadRecordsByMemberPort, loadMemberPort);
        given(loadMemberPort.loadMember(MEMBER_ID)).willReturn(Optional.of(memberWithResetHour(5)));
        given(loadRecordsByMemberPort.loadRecordsByMemberAndDateRange(eq(MEMBER_ID), any(), any()))
                .willReturn(List.of());

        // 주간 뷰가 요일별로 7회 병렬 호출하는 것을 흉내낸다.
        for (int i = 0; i < 7; i++) {
            LocalDate day = LocalDate.of(2026, 7, 5).plusDays(i);
            recordSummaryService.getSummary(MEMBER_ID, day, day);
        }

        verify(loadMemberPort, times(1)).loadMember(MEMBER_ID);
    }

    @Test
    @DisplayName("존재하지 않는 회원이면 DomainException을 던진다")
    void getSummary_memberNotFound_throws() {
        recordSummaryService = new RecordSummaryService(loadRecordsByMemberPort, loadMemberPort);
        given(loadMemberPort.loadMember(MEMBER_ID)).willReturn(Optional.empty());

        LocalDate today = LocalDate.of(2026, 7, 5);
        assertThatThrownBy(() -> recordSummaryService.getSummary(MEMBER_ID, today, today))
                .isInstanceOf(DomainException.class);
    }
}
