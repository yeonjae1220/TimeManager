package project.TimeManager.adapter.in.web.security;

import project.TimeManager.domain.member.model.MemberId;

public interface JwtTokenProvider {
    String generateAccessToken(MemberId memberId);
    String generateRefreshToken();
    MemberId extractMemberId(String token);
    boolean validateAccessToken(String token);
}
