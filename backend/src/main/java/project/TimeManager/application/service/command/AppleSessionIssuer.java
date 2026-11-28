package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.application.dto.result.AppleIdentity;
import project.TimeManager.application.dto.result.SocialLoginResult;
import project.TimeManager.domain.auth.model.AuthSession;
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

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Sign in with Apple — 회원 확정과 세션 발급(트랜잭션 구간). Google 과 달리 **회원 식별은 이메일이 아니라 Apple 의 sub 로 한다** —
 * 사용자가 '이메일 가리기'를 고르면 앱마다 다른 릴레이 주소가 오고, 나중에 바꿀 수도 있다.
 *
 * 이메일은 신규 가입 때 중복 검사에만 쓴다. 같은 이메일의 계정이 이미 있으면 제공자와 무관하게
 * 거부한다(계정 연결 미지원). 그대로 로그인시키면 Apple 로 남의 Google 계정에 들어가는 경로가 된다.
 */
@Service
@Transactional
@RequiredArgsConstructor
public class AppleSessionIssuer {

    private static final int MAX_NAME_LENGTH = 50;
    private static final Pattern CONTROL_CHARS = Pattern.compile("\\p{Cntrl}");

    @Value("${jwt.refresh-token-ttl-minutes:43200}")
    private long refreshTokenTtlMinutes;

    private final LoadMemberPort loadMemberPort;
    private final SaveMemberPort saveMemberPort;
    private final InitializeMemberTagsPort initializeMemberTagsPort;
    private final TokenGeneratorPort tokenGeneratorPort;
    private final TokenStorePort tokenStorePort;

    /** 검증을 마친 신원으로 회원을 찾거나 만들고 세션을 발급한다. 토큰 검증은 호출부(AppleAuthCommandService) 몫이다. */
    public SocialLoginResult issue(AppleIdentity identity, String fullName) {
        Optional<Member> existing = loadMemberPort.findMemberByProvider(OAuthProvider.APPLE, identity.subject());
        MemberId memberId = existing.map(Member::getId).orElseGet(() -> register(identity, fullName));

        // 소셜 회원에게는 JWT ADMIN 권한을 주지 않는다(GoogleSessionIssuer 와 같은 규칙).
        String accessToken = tokenGeneratorPort.generateAccessToken(memberId, MemberRole.MEMBER);
        String refreshToken = tokenGeneratorPort.generateRefreshToken();
        Instant expiresAt = Instant.now().plus(refreshTokenTtlMinutes, ChronoUnit.MINUTES);
        tokenStorePort.save(AuthSession.create(memberId, refreshToken, expiresAt));

        return new SocialLoginResult(accessToken, refreshToken, memberId.value(), existing.isEmpty());
    }

    private MemberId register(AppleIdentity identity, String fullName) {
        String email = identity.email() == null ? null : identity.email().strip().toLowerCase(Locale.ROOT);
        if (email == null || email.isBlank() || !identity.emailVerified()) {
            throw new DomainException("Apple 계정에서 확인된 이메일을 받지 못했습니다");
        }
        if (loadMemberPort.findMemberByEmail(email).isPresent()) {
            throw new DomainException("이미 같은 이메일로 가입된 계정이 있습니다. 기존 방식으로 로그인해 주세요");
        }

        Member member = Member.registerWithOAuth(displayName(fullName, email), email, OAuthProvider.APPLE, identity.subject());
        MemberId memberId = MemberId.of(saveMemberPort.saveMember(member));
        initializeMemberTagsPort.initializeDefaultTags(memberId);
        return memberId;
    }

    private static String displayName(String fullName, String email) {
        String cleaned = fullName == null ? "" : CONTROL_CHARS.matcher(fullName).replaceAll("").strip();
        if (cleaned.isEmpty()) {
            int at = email.indexOf('@');
            cleaned = at > 0 ? email.substring(0, at) : email;
        }
        // 코드포인트 단위로 자른다 — char 단위로 자르면 이모지 등 서로게이트 쌍이 반쪽만 남는다.
        return cleaned.codePointCount(0, cleaned.length()) > MAX_NAME_LENGTH
                ? cleaned.substring(0, cleaned.offsetByCodePoints(0, MAX_NAME_LENGTH))
                : cleaned;
    }
}
