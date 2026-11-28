package project.TimeManager.application.service.command;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.application.dto.command.auth.GoogleLoginCommand;
import project.TimeManager.application.dto.result.GoogleLoginResult;
import project.TimeManager.application.dto.result.GoogleUserProfile;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.port.out.auth.GoogleOAuthPort;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;

@ExtendWith(MockitoExtension.class)
@DisplayName("GoogleAuthCommandService — 진입점")
class GoogleAuthCommandServiceTest {

    @Mock GoogleOAuthPort googleOAuthPort;
    @Mock GoogleSessionIssuer googleSessionIssuer;

    @InjectMocks GoogleAuthCommandService service;

    private static final GoogleLoginCommand COMMAND = new GoogleLoginCommand("code", "https://x/oauth/callback");

    @Test
    @DisplayName("이메일이 확인된 프로필을 세션 발급에 넘긴다")
    void verifiedProfileIsIssued() {
        GoogleUserProfile profile = new GoogleUserProfile("a@gmail.com", "n", null, "gsub", true);
        GoogleLoginResult issued = new GoogleLoginResult("a", "r", 1L, false);
        given(googleOAuthPort.getUserProfile(any(), any())).willReturn(profile);
        given(googleSessionIssuer.issue(profile)).willReturn(issued);

        assertThat(service.loginWithGoogle(COMMAND)).isSameAs(issued);
    }

    @Test
    @DisplayName("Google 이 이메일 소유를 확인하지 않았으면 DB 작업 전에 거부한다")
    void rejectsUnverifiedEmail() {
        given(googleOAuthPort.getUserProfile(any(), any()))
                .willReturn(new GoogleUserProfile("a@gmail.com", "n", null, "gsub", false));

        assertThatThrownBy(() -> service.loginWithGoogle(COMMAND)).isInstanceOf(DomainException.class);
        then(googleSessionIssuer).should(never()).issue(any());
    }

    @Test
    @DisplayName("Google 호출이 실패하면 DB 작업에 들어가지 않는다")
    void doesNotTouchDbWhenGoogleFails() {
        given(googleOAuthPort.getUserProfile(any(), any())).willThrow(new DomainException("invalid code"));

        assertThatThrownBy(() -> service.loginWithGoogle(COMMAND)).isInstanceOf(DomainException.class);
        then(googleSessionIssuer).should(never()).issue(any());
    }

    @Test
    @DisplayName("진입점은 트랜잭션이 아니다 — Google HTTP 왕복 동안 DB 커넥션을 쥐지 않는다")
    void entryPointIsNotTransactional() throws NoSuchMethodException {
        Method method = GoogleAuthCommandService.class.getMethod("loginWithGoogle", GoogleLoginCommand.class);

        assertThat(GoogleAuthCommandService.class.isAnnotationPresent(Transactional.class)).isFalse();
        assertThat(method.isAnnotationPresent(Transactional.class)).isFalse();
        assertThat(GoogleSessionIssuer.class.isAnnotationPresent(Transactional.class)).isTrue();
    }
}
