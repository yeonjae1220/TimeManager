package project.TimeManager.application.service.command;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import project.TimeManager.domain.port.out.auth.AppleRefreshTokenStorePort;
import project.TimeManager.domain.port.out.auth.AppleTokenPort;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;

@ExtendWith(MockitoExtension.class)
@DisplayName("AppleTokenLifecycle")
class AppleTokenLifecycleTest {

    @Mock AppleTokenPort appleTokenPort;
    @Mock AppleRefreshTokenStorePort tokenStore;
    @InjectMocks AppleTokenLifecycle lifecycle;

    @Test
    @DisplayName("로그인: code 를 교환한 refresh token 을 저장한다")
    void storesExchangedToken() {
        given(appleTokenPort.isEnabled()).willReturn(true);
        given(appleTokenPort.exchangeAuthorizationCode("code")).willReturn(Optional.of("r.1"));

        lifecycle.storeAfterLogin(7L, "code");

        then(tokenStore).should().save(7L, "r.1");
    }

    @Test
    @DisplayName("로그인: 기능이 꺼져 있거나 code 가 없으면(구버전 앱) Apple 을 부르지 않는다")
    void skipsWhenDisabledOrNoCode() {
        given(appleTokenPort.isEnabled()).willReturn(false, true, true);

        lifecycle.storeAfterLogin(7L, "code");
        lifecycle.storeAfterLogin(7L, null);
        lifecycle.storeAfterLogin(7L, " ");

        then(appleTokenPort).should(never()).exchangeAuthorizationCode(any());
        then(tokenStore).shouldHaveNoInteractions();
    }

    @Test
    @DisplayName("로그인: 교환·저장이 실패해도 예외를 던지지 않는다 — 로그인을 깨지 않는다")
    void neverThrowsAtLogin() {
        given(appleTokenPort.isEnabled()).willReturn(true);
        given(appleTokenPort.exchangeAuthorizationCode("code")).willReturn(Optional.of("r.1"));
        willThrow(new IllegalStateException("db down")).given(tokenStore).save(anyLong(), any());

        assertThatCode(() -> lifecycle.storeAfterLogin(7L, "code")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("삭제: 저장된 토큰을 철회하고 성공하면 지운다")
    void revokesAndClears() {
        given(appleTokenPort.isEnabled()).willReturn(true);
        given(tokenStore.find(7L)).willReturn(Optional.of("r.1"));
        given(appleTokenPort.revokeRefreshToken("r.1")).willReturn(true);

        assertThat(lifecycle.revokeQuietly(7L)).isTrue();
        then(tokenStore).should().clear(7L);
    }

    @Test
    @DisplayName("삭제: 철회가 실패하면 토큰을 남겨 둔다(purge 때 재시도)")
    void keepsTokenWhenRevokeFails() {
        given(appleTokenPort.isEnabled()).willReturn(true);
        given(tokenStore.find(7L)).willReturn(Optional.of("r.1"));
        given(appleTokenPort.revokeRefreshToken("r.1")).willReturn(false);

        assertThat(lifecycle.revokeQuietly(7L)).isFalse();
        then(tokenStore).should(never()).clear(anyLong());
    }

    @Test
    @DisplayName("삭제: 저장된 토큰이 없으면(Apple 회원 아님) Apple 을 부르지 않는다. 복호화 오류도 삼킨다")
    void noTokenOrDecryptError() {
        given(appleTokenPort.isEnabled()).willReturn(true);
        given(tokenStore.find(7L)).willReturn(Optional.empty());
        given(tokenStore.find(8L)).willThrow(new IllegalStateException("decrypt"));

        assertThat(lifecycle.revokeQuietly(7L)).isTrue();
        assertThat(lifecycle.revokeQuietly(8L)).isFalse();
        then(appleTokenPort).should(never()).revokeRefreshToken(any());
    }
}
