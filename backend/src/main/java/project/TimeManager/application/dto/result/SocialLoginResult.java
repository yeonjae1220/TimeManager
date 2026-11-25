package project.TimeManager.application.dto.result;

public record SocialLoginResult(
        String accessToken,
        String refreshToken,
        Long memberId,
        boolean newMember
) {}
