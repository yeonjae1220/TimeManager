package project.TimeManager.application.service.command;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import project.TimeManager.application.dto.command.auth.GoogleLoginCommand;
import project.TimeManager.application.dto.result.GoogleLoginResult;
import project.TimeManager.application.dto.result.GoogleUserProfile;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.member.model.MemberRole;
import project.TimeManager.domain.member.model.OAuthProvider;
import project.TimeManager.domain.port.out.auth.GoogleOAuthPort;
import project.TimeManager.domain.port.out.auth.TokenGeneratorPort;
import project.TimeManager.domain.port.out.auth.TokenStorePort;
import project.TimeManager.domain.port.out.member.InitializeMemberTagsPort;
import project.TimeManager.domain.port.out.member.LoadMemberPort;
import project.TimeManager.domain.port.out.member.SaveMemberPort;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;

@ExtendWith(MockitoExtension.class)
@DisplayName("GoogleAuthCommandService — 기존 회원 매칭")
class GoogleAuthCommandServiceTest {

    @Mock GoogleOAuthPort googleOAuthPort;
    @Mock LoadMemberPort loadMemberPort;
    @Mock SaveMemberPort saveMemberPort;
    @Mock InitializeMemberTagsPort initializeMemberTagsPort;
    @Mock TokenGeneratorPort tokenGeneratorPort;
    @Mock TokenStorePort tokenStorePort;

    @InjectMocks GoogleAuthCommandService service;

    private static final String EMAIL = "a@gmail.com";
    private static final GoogleLoginCommand COMMAND = new GoogleLoginCommand("code", "https://x/oauth/callback");

    private static Member member(OAuthProvider provider) {
        return Member.reconstitute(MemberId.of(5L), "tester", EMAIL, null,
                provider, "pid", MemberRole.MEMBER, null, 5, null);
    }

    @Test
    @DisplayName("같은 이메일의 Apple 회원이 있으면 거부한다 — Google 로그인으로 Apple 계정에 들어가지 않는다")
    void rejectsAppleMemberWithSameEmail() {
        given(googleOAuthPort.getUserProfile(any(), any())).willReturn(new GoogleUserProfile(EMAIL, "n", null, "gsub", true));
        given(loadMemberPort.findMemberByEmail(EMAIL)).willReturn(Optional.of(member(OAuthProvider.APPLE)));

        assertThatThrownBy(() -> service.loginWithGoogle(COMMAND)).isInstanceOf(DomainException.class);
        then(tokenStorePort).should(never()).save(any());
    }

    @Test
    @DisplayName("같은 이메일의 Google 회원이면 그대로 로그인한다")
    void logsInGoogleMember() {
        ReflectionTestUtils.setField(service, "refreshTokenTtlMinutes", 43200L);
        given(googleOAuthPort.getUserProfile(any(), any())).willReturn(new GoogleUserProfile(EMAIL, "n", null, "gsub", true));
        given(loadMemberPort.findMemberByEmail(EMAIL)).willReturn(Optional.of(member(OAuthProvider.GOOGLE)));
        given(tokenGeneratorPort.generateAccessToken(any(), any())).willReturn("access");
        given(tokenGeneratorPort.generateRefreshToken()).willReturn("refresh");

        GoogleLoginResult result = service.loginWithGoogle(COMMAND);

        assertThat(result.memberId()).isEqualTo(5L);
        assertThat(result.newMember()).isFalse();
    }

    @Test
    @DisplayName("Google 이 이메일 소유를 확인하지 않았으면 회원 조회 전에 거부한다")
    void rejectsUnverifiedEmail() {
        given(googleOAuthPort.getUserProfile(any(), any())).willReturn(new GoogleUserProfile(EMAIL, "n", null, "gsub", false));

        assertThatThrownBy(() -> service.loginWithGoogle(COMMAND)).isInstanceOf(DomainException.class);
        then(loadMemberPort).should(never()).findMemberByEmail(any());
        then(saveMemberPort).should(never()).saveMember(any());
        then(tokenStorePort).should(never()).save(any());
    }
}
