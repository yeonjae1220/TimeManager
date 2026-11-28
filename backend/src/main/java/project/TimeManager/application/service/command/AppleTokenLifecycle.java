package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import project.TimeManager.domain.port.out.auth.AppleRefreshTokenStorePort;
import project.TimeManager.domain.port.out.auth.AppleTokenPort;

import java.util.Optional;

/**
 * Apple 승인의 수명 — 로그인 때 refresh token 을 받아 두고, 계정을 지울 때 그걸로 철회한다
 * (App Store 가이드라인 5.1.1(v)). 웹에서 계정을 지워도 철회되도록 토큰을 서버에 둔다.
 *
 * <p>⚠️ 두 메서드 모두 Apple 을 HTTP 로 부르므로 <b>트랜잭션 밖에서</b> 호출해야 한다(DB 커넥션을 쥔 채
 * 외부 응답을 기다리지 않게). 그리고 둘 다 예외를 던지지 않는다 — 로그인·탈퇴가 이 부가 작업 때문에
 * 실패하면 안 된다. 철회에 실패한 토큰은 지우지 않고 남겨 purge 때 한 번 더 시도한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AppleTokenLifecycle {

    private final AppleTokenPort appleTokenPort;
    private final AppleRefreshTokenStorePort tokenStore;

    /** 로그인 직후. 앱이 authorizationCode 를 안 보냈거나(구버전) 기능이 꺼져 있으면 아무것도 안 한다. */
    public void storeAfterLogin(Long memberId, String authorizationCode) {
        if (!appleTokenPort.isEnabled() || authorizationCode == null || authorizationCode.isBlank()) return;
        try {
            Optional<String> refreshToken = appleTokenPort.exchangeAuthorizationCode(authorizationCode);
            if (refreshToken.isEmpty()) {
                log.warn("apple.token not obtained at login memberId={} — 이 계정은 삭제 때 철회할 토큰이 없다", memberId);
                return;
            }
            tokenStore.save(memberId, refreshToken.get());
        } catch (RuntimeException e) {
            log.warn("apple.token store failed at login memberId={}", memberId, e);
        }
    }

    /** @return 철회할 게 없거나 철회에 성공했으면 true. 실패(토큰은 남겨 둠)면 false. */
    public boolean revokeQuietly(Long memberId) {
        if (!appleTokenPort.isEnabled()) return true;
        try {
            // 같은 Apple ID 로 재가입한 활성 계정이 있으면 철회하지 않는다(그 계정의 승인까지 끊긴다).
            // 옛 행은 purge 가 토큰째 지운다.
            Optional<String> refreshToken = tokenStore.findRevocable(memberId);
            if (refreshToken.isEmpty()) return true;
            if (!appleTokenPort.revokeRefreshToken(refreshToken.get())) {
                log.warn("apple.token revoke failed memberId={} — 토큰을 남겨 두고 purge 때 다시 시도한다", memberId);
                return false;
            }
            tokenStore.clear(memberId);
            log.info("apple.token revoked memberId={}", memberId);
            return true;
        } catch (RuntimeException e) {
            log.warn("apple.token revoke errored memberId={}", memberId, e);
            return false;
        }
    }
}
