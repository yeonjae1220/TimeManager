package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import project.TimeManager.application.dto.command.auth.GoogleLoginCommand;
import project.TimeManager.application.dto.result.GoogleLoginResult;
import project.TimeManager.application.dto.result.GoogleUserProfile;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.port.in.auth.GoogleLoginUseCase;
import project.TimeManager.domain.port.out.auth.GoogleOAuthPort;

/**
 * Google 로그인 진입점. ⚠️ 일부러 @Transactional 이 아니다({@link AppleAuthCommandService} 와 같은 이유).
 *
 * code 교환과 userinfo 조회는 Google 로 가는 HTTP 왕복 두 번이다. 트랜잭션 안에서 하면 그동안
 * DB 커넥션을 쥐고 있어서, 아무 문자열이나 code 로 보내는 요청 몇 개로 커넥션 풀을 말릴 수 있다.
 * 그래서 HTTP 를 먼저 끝내고, DB 작업만 {@link GoogleSessionIssuer} 의 트랜잭션에서 한다.
 */
@Service
@RequiredArgsConstructor
public class GoogleAuthCommandService implements GoogleLoginUseCase {

    private final GoogleOAuthPort googleOAuthPort;
    private final GoogleSessionIssuer googleSessionIssuer;

    @Override
    public GoogleLoginResult loginWithGoogle(GoogleLoginCommand command) {
        GoogleUserProfile profile = googleOAuthPort.getUserProfile(command.code(), command.redirectUri());
        // 회원은 이메일로 찾는다. 소유가 확인되지 않은 이메일을 믿으면 남의 주소를 단 Google 계정으로
        // 그 주소의 Google 회원에 들어가거나, 남의 주소로 새 계정을 선점할 수 있다.
        if (!profile.emailVerified() || profile.email() == null || profile.email().isBlank()) {
            throw new DomainException("이메일 인증이 완료된 Google 계정으로만 로그인할 수 있습니다");
        }
        return googleSessionIssuer.issue(profile);
    }
}
