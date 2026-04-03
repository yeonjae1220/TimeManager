package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.application.dto.command.auth.GoogleLoginCommand;
import project.TimeManager.application.dto.result.GoogleLoginResult;
import project.TimeManager.application.dto.result.GoogleUserProfile;
import project.TimeManager.domain.auth.model.AuthSession;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.member.model.OAuthProvider;
import project.TimeManager.domain.port.in.auth.GoogleLoginUseCase;
import project.TimeManager.domain.port.out.auth.GoogleOAuthPort;
import project.TimeManager.domain.port.out.auth.TokenGeneratorPort;
import project.TimeManager.domain.port.out.auth.TokenStorePort;
import project.TimeManager.domain.port.out.member.InitializeMemberTagsPort;
import project.TimeManager.domain.port.out.member.LoadMemberPort;
import project.TimeManager.domain.port.out.member.SaveMemberPort;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

@Service
@Transactional
@RequiredArgsConstructor
public class GoogleAuthCommandService implements GoogleLoginUseCase {

    private static final long REFRESH_TOKEN_TTL_DAYS = 7L;

    private final GoogleOAuthPort googleOAuthPort;
    private final LoadMemberPort loadMemberPort;
    private final SaveMemberPort saveMemberPort;
    private final InitializeMemberTagsPort initializeMemberTagsPort;
    private final TokenGeneratorPort tokenGeneratorPort;
    private final TokenStorePort tokenStorePort;

    @Override
    public GoogleLoginResult loginWithGoogle(GoogleLoginCommand command) {
        GoogleUserProfile profile = googleOAuthPort.getUserProfile(command.code(), command.redirectUri());

        Optional<Member> existing = loadMemberPort.findMemberByEmail(profile.email());

        boolean isNewMember;
        MemberId memberId;

        if (existing.isPresent()) {
            Member member = existing.get();
            if (member.getProvider() == OAuthProvider.LOCAL) {
                throw new DomainException("이미 이메일/비밀번호로 가입된 계정입니다. 일반 로그인을 사용해 주세요");
            }
            memberId = member.getId();
            isNewMember = false;
        } else {
            Member newMember = Member.registerWithOAuth(
                    profile.name(), profile.email(), OAuthProvider.GOOGLE, profile.googleId());
            Long savedId = saveMemberPort.saveMember(newMember);
            memberId = MemberId.of(savedId);
            initializeMemberTagsPort.initializeDefaultTags(memberId);
            isNewMember = true;
        }

        String accessToken = tokenGeneratorPort.generateAccessToken(memberId);
        String refreshToken = tokenGeneratorPort.generateRefreshToken();
        Instant expiresAt = Instant.now().plus(REFRESH_TOKEN_TTL_DAYS, ChronoUnit.DAYS);
        AuthSession session = AuthSession.create(memberId, refreshToken, expiresAt);
        tokenStorePort.save(session);

        return new GoogleLoginResult(accessToken, refreshToken, memberId.value(), isNewMember);
    }
}
