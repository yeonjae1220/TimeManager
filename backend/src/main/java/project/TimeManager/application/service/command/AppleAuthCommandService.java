package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import project.TimeManager.application.dto.command.auth.AppleLoginCommand;
import project.TimeManager.application.dto.result.AppleIdentity;
import project.TimeManager.application.dto.result.SocialLoginResult;
import project.TimeManager.domain.port.in.auth.AppleLoginUseCase;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.port.out.auth.AppleIdentityTokenPort;
import project.TimeManager.domain.port.out.auth.IdentityTokenReplayGuardPort;

/**
 * Sign in with Apple 진입점. ⚠️ 일부러 @Transactional 이 아니다.
 *
 * 토큰 검증은 처음 보는 kid 마다 Apple JWKS 를 HTTP 로 다시 받는다. 트랜잭션 안에서 하면 그동안
 * DB 커넥션을 쥐고 있어서, 인증 없이 보낼 수 있는 가짜 kid 토큰 몇 개로 커넥션 풀을 말릴 수 있다.
 * 그래서 검증을 먼저 끝내고, DB 작업만 {@link AppleSessionIssuer} 의 트랜잭션에서 한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AppleAuthCommandService implements AppleLoginUseCase {

    private final AppleIdentityTokenPort appleIdentityTokenPort;
    private final AppleSessionIssuer appleSessionIssuer;
    private final IdentityTokenReplayGuardPort replayGuardPort;
    private final AppleTokenLifecycle appleTokenLifecycle;

    @Override
    public SocialLoginResult loginWithApple(AppleLoginCommand command) {
        AppleIdentity identity = appleIdentityTokenPort.verify(command.identityToken(), command.rawNonce());
        // 검증을 통과한 뒤에 기록한다 — 가짜 토큰으로 Redis 를 채우지 못하게.
        if (!replayGuardPort.markUsedOnce(command.identityToken(), identity.expiresAt())) {
            log.info("auth.apple.fail reason=token_replayed");
            throw new DomainException("Apple 로그인 토큰이 유효하지 않습니다");
        }
        SocialLoginResult result = appleSessionIssuer.issue(identity, command.fullName());
        // 세션 발급(커밋) 뒤, 트랜잭션 밖에서. 실패해도 로그인은 성공이다 — 철회용 토큰을 못 받았을 뿐이다.
        appleTokenLifecycle.storeAfterLogin(result.memberId(), command.authorizationCode());
        return result;
    }
}
