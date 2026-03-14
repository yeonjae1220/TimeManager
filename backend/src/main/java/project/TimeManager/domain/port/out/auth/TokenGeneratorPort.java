package project.TimeManager.domain.port.out.auth;

import project.TimeManager.domain.member.model.MemberId;

public interface TokenGeneratorPort {
    String generateAccessToken(MemberId memberId);
    String generateRefreshToken();
}
