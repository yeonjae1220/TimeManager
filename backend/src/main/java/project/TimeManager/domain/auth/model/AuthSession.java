package project.TimeManager.domain.auth.model;

import project.TimeManager.domain.member.model.MemberId;

import java.time.Instant;

public class AuthSession {

    private MemberId memberId;
    private String refreshToken;
    private Instant expiresAt;

    private AuthSession() {}

    public static AuthSession create(MemberId memberId, String refreshToken, Instant expiresAt) {
        AuthSession session = new AuthSession();
        session.memberId = memberId;
        session.refreshToken = refreshToken;
        session.expiresAt = expiresAt;
        return session;
    }

    public static AuthSession reconstitute(MemberId memberId, String refreshToken, Instant expiresAt) {
        return create(memberId, refreshToken, expiresAt);
    }

    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }

    public void rotate(String newRefreshToken, Instant newExpiry) {
        this.refreshToken = newRefreshToken;
        this.expiresAt = newExpiry;
    }

    public MemberId getMemberId() { return memberId; }
    public String getRefreshToken() { return refreshToken; }
    public Instant getExpiresAt() { return expiresAt; }
}
