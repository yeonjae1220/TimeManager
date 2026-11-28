package project.TimeManager.application.service.command;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import project.TimeManager.application.dto.result.AppleIdentity;
import project.TimeManager.application.dto.result.SocialLoginResult;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.member.model.MemberRole;
import project.TimeManager.domain.member.model.OAuthProvider;
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
@DisplayName("AppleSessionIssuer")
class AppleSessionIssuerTest {

    private static final java.time.Instant EXP = java.time.Instant.parse("2030-01-01T00:00:00Z");

    @Mock LoadMemberPort loadMemberPort;
    @Mock SaveMemberPort saveMemberPort;
    @Mock InitializeMemberTagsPort initializeMemberTagsPort;
    @Mock TokenGeneratorPort tokenGeneratorPort;
    @Mock TokenStorePort tokenStorePort;

    @InjectMocks AppleSessionIssuer service;

    private static final String SUB = "001234.abcdef.0987";
    private static final String EMAIL = "x7@privaterelay.appleid.com";

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "refreshTokenTtlMinutes", 43200L);
    }

    private void tokensIssued() {
        given(tokenGeneratorPort.generateAccessToken(any(), any())).willReturn("access");
        given(tokenGeneratorPort.generateRefreshToken()).willReturn("refresh");
    }

    private static Member member(long id, String email, OAuthProvider provider) {
        return Member.reconstitute(MemberId.of(id), "tester", email, null,
                provider, "pid", MemberRole.MEMBER, null, 5, null);
    }

    @Test
    @DisplayName("같은 Apple sub 의 회원이 있으면 이메일이 바뀌었어도 그 회원으로 로그인한다")
    void logsInExistingMemberBySubject() {
        AppleIdentity identity = new AppleIdentity(SUB, "changed@relay.com", true, EXP);
        given(loadMemberPort.findMemberByProvider(OAuthProvider.APPLE, SUB)).willReturn(Optional.of(member(7, EMAIL, OAuthProvider.APPLE)));
        tokensIssued();

        SocialLoginResult result = service.issue(identity, null);

        assertThat(result.memberId()).isEqualTo(7L);
        assertThat(result.newMember()).isFalse();
        then(saveMemberPort).should(never()).saveMember(any());
        then(tokenStorePort).should().save(any());
    }

    @Test
    @DisplayName("처음 보는 sub 이면 받은 이름으로 가입시키고 기본 태그를 만든다")
    void registersNewMemberWithGivenName() {
        AppleIdentity identity = new AppleIdentity(SUB, EMAIL, true, EXP);
        given(loadMemberPort.findMemberByProvider(OAuthProvider.APPLE, SUB)).willReturn(Optional.empty());
        given(loadMemberPort.findMemberByEmail(EMAIL)).willReturn(Optional.empty());
        given(saveMemberPort.saveMember(any())).willReturn(9L);
        tokensIssued();

        SocialLoginResult result = service.issue(identity, "  연재 김 ");

        ArgumentCaptor<Member> saved = ArgumentCaptor.forClass(Member.class);
        then(saveMemberPort).should().saveMember(saved.capture());
        assertThat(saved.getValue().getName()).isEqualTo("연재 김");
        assertThat(saved.getValue().getProvider()).isEqualTo(OAuthProvider.APPLE);
        assertThat(saved.getValue().getProviderId()).isEqualTo(SUB);
        then(initializeMemberTagsPort).should().initializeDefaultTags(MemberId.of(9L));
        assertThat(result.newMember()).isTrue();
    }

    @Test
    @DisplayName("이름을 받지 못하면 이메일 앞부분을 이름으로 쓴다")
    void fallsBackToEmailLocalPartForName() {
        AppleIdentity identity = new AppleIdentity(SUB, EMAIL, true, EXP);
        given(loadMemberPort.findMemberByProvider(OAuthProvider.APPLE, SUB)).willReturn(Optional.empty());
        given(loadMemberPort.findMemberByEmail(EMAIL)).willReturn(Optional.empty());
        given(saveMemberPort.saveMember(any())).willReturn(9L);
        tokensIssued();

        service.issue(identity, null);

        ArgumentCaptor<Member> saved = ArgumentCaptor.forClass(Member.class);
        then(saveMemberPort).should().saveMember(saved.capture());
        assertThat(saved.getValue().getName()).isEqualTo("x7");
    }

    @Test
    @DisplayName("같은 이메일의 일반 가입 계정이 있으면 거부한다 — 비밀번호 계정을 소셜로 가로채지 않는다")
    void rejectsWhenLocalAccountOwnsEmail() {
        AppleIdentity identity = new AppleIdentity(SUB, EMAIL, true, EXP);
        given(loadMemberPort.findMemberByProvider(OAuthProvider.APPLE, SUB)).willReturn(Optional.empty());
        given(loadMemberPort.findMemberByEmail(EMAIL)).willReturn(Optional.of(member(3, EMAIL, OAuthProvider.LOCAL)));

        assertThatThrownBy(() -> service.issue(identity, null))
                .isInstanceOf(DomainException.class);
        then(tokenStorePort).should(never()).save(any());
    }

    @Test
    @DisplayName("같은 이메일의 다른 소셜 계정이 있어도 거부한다 — 계정 연결은 지원하지 않는다")
    void rejectsWhenOtherSocialAccountOwnsEmail() {
        AppleIdentity identity = new AppleIdentity(SUB, EMAIL, true, EXP);
        given(loadMemberPort.findMemberByProvider(OAuthProvider.APPLE, SUB)).willReturn(Optional.empty());
        given(loadMemberPort.findMemberByEmail(EMAIL)).willReturn(Optional.of(member(3, EMAIL, OAuthProvider.GOOGLE)));

        assertThatThrownBy(() -> service.issue(identity, null))
                .isInstanceOf(DomainException.class);
        then(tokenStorePort).should(never()).save(any());
    }

    @Test
    @DisplayName("처음 보는 sub 인데 이메일이 없거나 미검증이면 가입시키지 않는다")
    void rejectsNewMemberWithoutVerifiedEmail() {
        AppleIdentity identity = new AppleIdentity(SUB, EMAIL, false, EXP);
        given(loadMemberPort.findMemberByProvider(OAuthProvider.APPLE, SUB)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.issue(identity, null))
                .isInstanceOf(DomainException.class);
        then(saveMemberPort).should(never()).saveMember(any());
    }

    @Test
    @DisplayName("Apple 이 대문자 섞인 이메일을 줘도 소문자로 비교·저장한다 — 기존 계정 검사를 빠져나가지 않게")
    void normalizesEmailCase() {
        AppleIdentity identity = new AppleIdentity(SUB, "Foo@Example.com", true, EXP);
        given(loadMemberPort.findMemberByProvider(OAuthProvider.APPLE, SUB)).willReturn(Optional.empty());
        given(loadMemberPort.findMemberByEmail("foo@example.com")).willReturn(Optional.of(member(3, "foo@example.com", OAuthProvider.LOCAL)));

        assertThatThrownBy(() -> service.issue(identity, null)).isInstanceOf(DomainException.class);
    }

    @Test
    @DisplayName("이름의 제어문자를 지우고, 이모지를 반쪽 내지 않고 50자로 자른다")
    void sanitizesAndTruncatesName() {
        AppleIdentity identity = new AppleIdentity(SUB, EMAIL, true, EXP);
        given(loadMemberPort.findMemberByProvider(OAuthProvider.APPLE, SUB)).willReturn(Optional.empty());
        given(loadMemberPort.findMemberByEmail(EMAIL)).willReturn(Optional.empty());
        given(saveMemberPort.saveMember(any())).willReturn(9L);
        tokensIssued();

        service.issue(identity, "a\u0000b" + "😀".repeat(60));

        ArgumentCaptor<Member> saved = ArgumentCaptor.forClass(Member.class);
        then(saveMemberPort).should().saveMember(saved.capture());
        String name = saved.getValue().getName();
        assertThat(name).startsWith("ab😀");
        assertThat(name.codePointCount(0, name.length())).isEqualTo(50);
        assertThat(Character.isHighSurrogate(name.charAt(name.length() - 1))).isFalse();
    }
}
