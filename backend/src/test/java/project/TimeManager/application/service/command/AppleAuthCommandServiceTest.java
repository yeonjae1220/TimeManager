package project.TimeManager.application.service.command;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import project.TimeManager.application.dto.command.auth.AppleLoginCommand;
import project.TimeManager.application.dto.result.AppleIdentity;
import project.TimeManager.application.dto.result.SocialLoginResult;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.port.out.auth.AppleIdentityTokenPort;
import project.TimeManager.domain.port.out.auth.IdentityTokenReplayGuardPort;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;

@ExtendWith(MockitoExtension.class)
@DisplayName("AppleAuthCommandService")
class AppleAuthCommandServiceTest {

    @Mock AppleIdentityTokenPort appleIdentityTokenPort;
    @Mock AppleSessionIssuer appleSessionIssuer;
    @Mock IdentityTokenReplayGuardPort replayGuardPort;
    @Mock AppleTokenLifecycle appleTokenLifecycle;

    private static final java.time.Instant EXP = java.time.Instant.parse("2030-01-01T00:00:00Z");

    @InjectMocks AppleAuthCommandService service;

    @Test
    @DisplayName("검증한 신원과 이름을 세션 발급에 넘긴다")
    void verifiesThenIssues() {
        AppleIdentity identity = new AppleIdentity("sub", "a@b.com", true, EXP);
        SocialLoginResult issued = new SocialLoginResult("a", "r", 1L, false);
        given(appleIdentityTokenPort.verify("tok", "nonce")).willReturn(identity);
        given(replayGuardPort.markUsedOnce("tok", EXP)).willReturn(true);
        given(appleSessionIssuer.issue(identity, "이름")).willReturn(issued);

        assertThat(service.loginWithApple(new AppleLoginCommand("tok", "nonce", "이름", "code"))).isSameAs(issued);
    }

    @Test
    @DisplayName("세션 발급 뒤 authorizationCode 로 철회용 Apple 토큰을 받아 둔다")
    void storesAppleTokenAfterIssuing() {
        AppleIdentity identity = new AppleIdentity("sub", "a@b.com", true, EXP);
        given(appleIdentityTokenPort.verify("tok", "nonce")).willReturn(identity);
        given(replayGuardPort.markUsedOnce("tok", EXP)).willReturn(true);
        given(appleSessionIssuer.issue(identity, null)).willReturn(new SocialLoginResult("a", "r", 42L, true));

        service.loginWithApple(new AppleLoginCommand("tok", "nonce", null, "code"));

        org.mockito.InOrder order = org.mockito.Mockito.inOrder(appleSessionIssuer, appleTokenLifecycle);
        order.verify(appleSessionIssuer).issue(identity, null);
        order.verify(appleTokenLifecycle).storeAfterLogin(42L, "code");
    }

    @Test
    @DisplayName("세션 발급이 실패하면(이메일 충돌 등) Apple 토큰을 교환하지 않는다")
    void doesNotStoreTokenWhenIssueFails() {
        AppleIdentity identity = new AppleIdentity("sub", "a@b.com", true, EXP);
        given(appleIdentityTokenPort.verify("tok", "nonce")).willReturn(identity);
        given(replayGuardPort.markUsedOnce("tok", EXP)).willReturn(true);
        given(appleSessionIssuer.issue(identity, null)).willThrow(new DomainException("dup"));

        assertThatThrownBy(() -> service.loginWithApple(new AppleLoginCommand("tok", "nonce", null, "code")))
                .isInstanceOf(DomainException.class);
        then(appleTokenLifecycle).shouldHaveNoInteractions();
    }

    @Test
    @DisplayName("검증이 실패하면 DB 작업에 들어가지 않는다")
    void doesNotTouchDbWhenVerificationFails() {
        given(appleIdentityTokenPort.verify("tok", "nonce")).willThrow(new DomainException("invalid"));

        assertThatThrownBy(() -> service.loginWithApple(new AppleLoginCommand("tok", "nonce", null, "code")))
                .isInstanceOf(DomainException.class);
        then(appleSessionIssuer).should(never()).issue(any(), any());
    }

    @Test
    @DisplayName("이미 쓰인 토큰을 다시 보내면 거부하고 세션을 발급하지 않는다")
    void rejectsReplayedToken() {
        AppleIdentity identity = new AppleIdentity("sub", "a@b.com", true, EXP);
        given(appleIdentityTokenPort.verify("tok", "nonce")).willReturn(identity);
        given(replayGuardPort.markUsedOnce("tok", EXP)).willReturn(false);

        assertThatThrownBy(() -> service.loginWithApple(new AppleLoginCommand("tok", "nonce", null, "code")))
                .isInstanceOf(DomainException.class);
        then(appleSessionIssuer).should(never()).issue(any(), any());
    }

    @Test
    @DisplayName("검증에 실패한 토큰은 사용 기록을 남기지 않는다 — 가짜 토큰으로 저장소를 채우지 못한다")
    void doesNotRecordUnverifiedToken() {
        given(appleIdentityTokenPort.verify("tok", "nonce")).willThrow(new DomainException("invalid"));

        assertThatThrownBy(() -> service.loginWithApple(new AppleLoginCommand("tok", "nonce", null, "code")))
                .isInstanceOf(DomainException.class);
        then(replayGuardPort).shouldHaveNoInteractions();
    }

    @Test
    @DisplayName("진입점은 트랜잭션이 아니다 — JWKS HTTP 호출 동안 DB 커넥션을 쥐지 않는다")
    void entryPointIsNotTransactional() throws NoSuchMethodException {
        Method method = AppleAuthCommandService.class.getMethod("loginWithApple", AppleLoginCommand.class);

        assertThat(AppleAuthCommandService.class.isAnnotationPresent(org.springframework.transaction.annotation.Transactional.class)).isFalse();
        assertThat(method.isAnnotationPresent(org.springframework.transaction.annotation.Transactional.class)).isFalse();
        assertThat(AppleSessionIssuer.class.isAnnotationPresent(org.springframework.transaction.annotation.Transactional.class)).isTrue();
    }
}
