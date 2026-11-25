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

    @InjectMocks AppleAuthCommandService service;

    @Test
    @DisplayName("검증한 신원과 이름을 세션 발급에 넘긴다")
    void verifiesThenIssues() {
        AppleIdentity identity = new AppleIdentity("sub", "a@b.com", true);
        SocialLoginResult issued = new SocialLoginResult("a", "r", 1L, false);
        given(appleIdentityTokenPort.verify("tok", "nonce")).willReturn(identity);
        given(appleSessionIssuer.issue(identity, "이름")).willReturn(issued);

        assertThat(service.loginWithApple(new AppleLoginCommand("tok", "nonce", "이름"))).isSameAs(issued);
    }

    @Test
    @DisplayName("검증이 실패하면 DB 작업에 들어가지 않는다")
    void doesNotTouchDbWhenVerificationFails() {
        given(appleIdentityTokenPort.verify("tok", "nonce")).willThrow(new DomainException("invalid"));

        assertThatThrownBy(() -> service.loginWithApple(new AppleLoginCommand("tok", "nonce", null)))
                .isInstanceOf(DomainException.class);
        then(appleSessionIssuer).should(never()).issue(any(), any());
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
