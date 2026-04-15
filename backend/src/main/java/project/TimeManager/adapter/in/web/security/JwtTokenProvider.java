package project.TimeManager.adapter.in.web.security;

import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.member.model.MemberRole;

public interface JwtTokenProvider {
    String generateAccessToken(MemberId memberId, MemberRole role);
    String generateRefreshToken();
    MemberId extractMemberId(String token);
    MemberRole extractRole(String token);
    boolean validateAccessToken(String token);
}
