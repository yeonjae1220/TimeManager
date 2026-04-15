package project.TimeManager.domain.port.out.auth;

import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.member.model.MemberRole;

public interface TokenGeneratorPort {
    String generateAccessToken(MemberId memberId, MemberRole role);
    String generateRefreshToken();
}
