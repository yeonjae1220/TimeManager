package project.TimeManager.application.service.command;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import project.TimeManager.application.dto.command.member.UpdateMemberProfileCommand;
import project.TimeManager.application.service.MemberDayBoundarySettingsCache;
import project.TimeManager.application.service.MemberDayBoundarySettingsCache.Settings;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.member.model.MemberRole;
import project.TimeManager.domain.member.model.OAuthProvider;
import project.TimeManager.domain.port.out.auth.PasswordHasherPort;
import project.TimeManager.domain.port.out.member.LoadMemberPort;
import project.TimeManager.domain.port.out.member.UpdateMemberPort;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
@DisplayName("UpdateMemberProfileCommandService")
class UpdateMemberProfileCommandServiceTest {

    @Mock
    LoadMemberPort loadMemberPort;

    @Mock
    UpdateMemberPort updateMemberPort;

    @Mock
    PasswordHasherPort passwordHasherPort;

    MemberDayBoundarySettingsCache dayBoundaryCache;
    UpdateMemberProfileCommandService service;

    private static final Long MEMBER_ID = 1L;

    private Member member() {
        return Member.reconstitute(
                MemberId.of(MEMBER_ID), "tester", "tester@example.com", "hashed",
                OAuthProvider.LOCAL, null, MemberRole.MEMBER,
                "Asia/Seoul", 5, LocalDateTime.now());
    }

    @BeforeEach
    void setUp() {
        dayBoundaryCache = new MemberDayBoundarySettingsCache();
        service = new UpdateMemberProfileCommandService(loadMemberPort, updateMemberPort, passwordHasherPort, dayBoundaryCache);
        given(loadMemberPort.loadMember(MEMBER_ID)).willReturn(Optional.of(member()));
    }

    @Test
    @DisplayName("dailyResetHour를 바꾸면 캐시를 무효화한다")
    void updateProfile_changesDailyResetHour_evictsCache() {
        dayBoundaryCache.put(MEMBER_ID, new Settings(ZoneId.of("Asia/Seoul"), 5));

        service.updateProfile(new UpdateMemberProfileCommand(MEMBER_ID, null, null, null, null, 7));

        assertThat(dayBoundaryCache.get(MEMBER_ID)).isEmpty();
    }

    @Test
    @DisplayName("timezone을 바꾸면 캐시를 무효화한다")
    void updateProfile_changesTimezone_evictsCache() {
        dayBoundaryCache.put(MEMBER_ID, new Settings(ZoneId.of("Asia/Seoul"), 5));

        service.updateProfile(new UpdateMemberProfileCommand(MEMBER_ID, null, null, null, "America/New_York", null));

        assertThat(dayBoundaryCache.get(MEMBER_ID)).isEmpty();
    }

    @Test
    @DisplayName("이름만 바꾸면 캐시를 건드리지 않는다")
    void updateProfile_changesNameOnly_doesNotTouchCache() {
        dayBoundaryCache.put(MEMBER_ID, new Settings(ZoneId.of("Asia/Seoul"), 5));

        service.updateProfile(new UpdateMemberProfileCommand(MEMBER_ID, "newName", null, null, null, null));

        assertThat(dayBoundaryCache.get(MEMBER_ID)).isPresent();
    }
}
