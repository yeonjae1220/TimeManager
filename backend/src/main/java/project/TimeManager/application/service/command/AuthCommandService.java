package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.application.dto.command.auth.LoginCommand;
import project.TimeManager.application.dto.command.auth.LogoutCommand;
import project.TimeManager.application.dto.command.auth.RefreshTokenCommand;
import project.TimeManager.application.dto.result.TokenPairResult;
import project.TimeManager.domain.auth.model.AuthSession;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.exception.InvalidCredentialsException;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.member.model.MemberRole;
import project.TimeManager.domain.port.in.auth.LoginUseCase;
import project.TimeManager.domain.port.in.auth.LogoutUseCase;
import project.TimeManager.domain.port.in.auth.RefreshTokenUseCase;
import project.TimeManager.domain.port.out.auth.LoadMemberCredentialsPort;
import project.TimeManager.domain.port.out.auth.PasswordHasherPort;
import project.TimeManager.domain.port.out.auth.TokenStorePort;
import project.TimeManager.domain.port.out.auth.TokenGeneratorPort;
import project.TimeManager.domain.port.out.member.LoadMemberPort;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class AuthCommandService implements LoginUseCase, RefreshTokenUseCase, LogoutUseCase {

    private static final String INVALID_CREDENTIALS_MSG = "이메일 또는 비밀번호가 올바르지 않습니다";

    /**
     * 타이밍 균등화용 고정 BCrypt 해시(cost 10 = BCryptPasswordEncoder 기본값, 60자).
     * 어떤 비밀번호와도 일치하지 않도록 임의 문자열을 해시한 값 — 비밀이 아니다.
     * 인코더 cost 를 바꾸면 이 값도 같은 cost 로 다시 만들어야 한다(AuthCommandServiceTest 가 검사).
     */
    static final String DUMMY_PASSWORD_HASH =
            "$2a$10$2TZTuH5zWyHayp2PpHDN0ewOsv4LHZuRaI9ufUdRzGTnp/9cSqBzm";

    @Value("${auth.rotation-interval-hours:24}")
    private long rotationIntervalHours;

    // 세션(=refresh 토큰) 만료와 쿠키 수명은 동일 소스에서 파생 (AuthApiController와 같은 키)
    @Value("${jwt.refresh-token-ttl-minutes:43200}")
    private long refreshTokenTtlMinutes;

    private final LoadMemberCredentialsPort loadMemberCredentialsPort;
    private final PasswordHasherPort passwordHasherPort;
    private final TokenStorePort tokenStorePort;
    private final TokenGeneratorPort tokenGeneratorPort;
    private final LoadMemberPort loadMemberPort;

    @Override
    public TokenPairResult login(LoginCommand command) {
        var credentials = loadMemberCredentialsPort.findByEmail(command.email());
        String hashedPassword = credentials.map(c -> c.hashedPassword()).orElse(null);

        // 없는 이메일·소셜 전용 계정(비밀번호 없음)도 더미 해시로 BCrypt 비교를 한 번 돌려
        // 응답 시간과 실패 문구로 가입 여부가 드러나지 않게 한다.
        boolean matched = passwordHasherPort.matches(command.password(),
                hashedPassword != null ? hashedPassword : DUMMY_PASSWORD_HASH);

        if (hashedPassword == null || !matched) {
            throw new InvalidCredentialsException(INVALID_CREDENTIALS_MSG);
        }

        return issueTokenPair(credentials.get().memberId());
    }

    @Override
    public TokenPairResult refresh(RefreshTokenCommand command) {
        AuthSession session = tokenStorePort.findByRefreshToken(command.refreshToken())
                .orElseThrow(() -> new DomainException("유효하지 않은 리프레시 토큰입니다"));

        if (session.isExpired()) {
            tokenStorePort.delete(command.refreshToken());
            throw new DomainException("만료된 리프레시 토큰입니다");
        }

        // 회원을 못 찾으면 기본 역할로 넘어가지 않고 끊는다. 탈퇴한 계정(조회에서
        // 제외됨)의 남은 리프레시 토큰이 액세스 토큰을 계속 찍어내던 구멍이었다 —
        // 세션 무효화는 정리일 뿐이고, 실제 관문은 여기다.
        MemberRole role = loadMemberPort.loadMember(session.getMemberId().value())
                .map(m -> m.getRole())
                .orElseThrow(() -> {
                    tokenStorePort.delete(command.refreshToken());
                    return new DomainException("유효하지 않은 리프레시 토큰입니다");
                });
        String newAccessToken = tokenGeneratorPort.generateAccessToken(session.getMemberId(), role);

        Duration rotationInterval = Duration.ofHours(rotationIntervalHours);
        if (session.isRotatedRecently(rotationInterval)) {
            log.debug("refresh: skip rotation for member={} (last rotated within {}h)",
                    session.getMemberId().value(), rotationIntervalHours);
            return new TokenPairResult(newAccessToken, command.refreshToken(), session.getMemberId().value());
        }

        log.debug("refresh: rotating token for member={}", session.getMemberId().value());
        String newRefreshToken = tokenGeneratorPort.generateRefreshToken();
        tokenStorePort.delete(command.refreshToken());
        session.rotate(newRefreshToken, newExpiresAt());
        tokenStorePort.save(session);
        return new TokenPairResult(newAccessToken, newRefreshToken, session.getMemberId().value());
    }

    @Override
    public void logout(LogoutCommand command) {
        tokenStorePort.delete(command.refreshToken());
    }

    private TokenPairResult issueTokenPair(MemberId memberId) {
        MemberRole role = loadMemberPort.loadMember(memberId.value())
                .map(m -> m.getRole()).orElse(MemberRole.MEMBER);
        String accessToken = tokenGeneratorPort.generateAccessToken(memberId, role);
        String refreshToken = tokenGeneratorPort.generateRefreshToken();
        AuthSession session = AuthSession.create(memberId, refreshToken, newExpiresAt());
        tokenStorePort.save(session);
        return new TokenPairResult(accessToken, refreshToken, memberId.value());
    }

    private Instant newExpiresAt() {
        return Instant.now().plus(refreshTokenTtlMinutes, ChronoUnit.MINUTES);
    }
}
