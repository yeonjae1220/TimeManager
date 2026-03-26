package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.application.dto.command.auth.LoginCommand;
import project.TimeManager.application.dto.command.auth.LogoutCommand;
import project.TimeManager.application.dto.command.auth.RefreshTokenCommand;
import project.TimeManager.application.dto.result.TokenPairResult;
import project.TimeManager.domain.auth.model.AuthSession;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.port.in.auth.LoginUseCase;
import project.TimeManager.domain.port.in.auth.LogoutUseCase;
import project.TimeManager.domain.port.in.auth.RefreshTokenUseCase;
import project.TimeManager.domain.port.out.auth.LoadMemberCredentialsPort;
import project.TimeManager.domain.port.out.auth.PasswordHasherPort;
import project.TimeManager.domain.port.out.auth.TokenStorePort;
import project.TimeManager.domain.port.out.auth.TokenGeneratorPort;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service
@Transactional
@RequiredArgsConstructor
public class AuthCommandService implements LoginUseCase, RefreshTokenUseCase, LogoutUseCase {

    private static final long REFRESH_TOKEN_TTL_DAYS = 7L;
    private static final String INVALID_CREDENTIALS_MSG = "이메일 또는 비밀번호가 올바르지 않습니다";

    private final LoadMemberCredentialsPort loadMemberCredentialsPort;
    private final PasswordHasherPort passwordHasherPort;
    private final TokenStorePort tokenStorePort;
    private final TokenGeneratorPort tokenGeneratorPort;

    @Override
    public TokenPairResult login(LoginCommand command) {
        var credentials = loadMemberCredentialsPort.findByEmail(command.email())
                .orElseThrow(() -> new DomainException(INVALID_CREDENTIALS_MSG));

        if (credentials.hashedPassword() == null) {
            throw new DomainException("소셜 로그인 계정입니다. Google 로그인을 사용해 주세요");
        }

        if (!passwordHasherPort.matches(command.password(), credentials.hashedPassword())) {
            throw new DomainException(INVALID_CREDENTIALS_MSG);
        }

        return issueTokenPair(credentials.memberId());
    }

    @Override
    public TokenPairResult refresh(RefreshTokenCommand command) {
        AuthSession session = tokenStorePort.findByRefreshToken(command.refreshToken())
                .orElseThrow(() -> new DomainException("유효하지 않은 리프레시 토큰입니다"));

        if (session.isExpired()) {
            tokenStorePort.delete(command.refreshToken());
            throw new DomainException("만료된 리프레시 토큰입니다");
        }

        String newRefreshToken = tokenGeneratorPort.generateRefreshToken();
        tokenStorePort.delete(command.refreshToken());
        session.rotate(newRefreshToken, newExpiresAt());
        tokenStorePort.save(session);

        String newAccessToken = tokenGeneratorPort.generateAccessToken(session.getMemberId());
        return new TokenPairResult(newAccessToken, newRefreshToken, session.getMemberId().value());
    }

    @Override
    public void logout(LogoutCommand command) {
        tokenStorePort.delete(command.refreshToken());
    }

    private TokenPairResult issueTokenPair(MemberId memberId) {
        String accessToken = tokenGeneratorPort.generateAccessToken(memberId);
        String refreshToken = tokenGeneratorPort.generateRefreshToken();
        AuthSession session = AuthSession.create(memberId, refreshToken, newExpiresAt());
        tokenStorePort.save(session);
        return new TokenPairResult(accessToken, refreshToken, memberId.value());
    }

    private Instant newExpiresAt() {
        return Instant.now().plus(REFRESH_TOKEN_TTL_DAYS, ChronoUnit.DAYS);
    }
}
