package project.TimeManager.domain.auth.model;

import project.TimeManager.domain.member.model.MemberId;

import java.time.Duration;
import java.time.Instant;

public class AuthSession {

    private MemberId memberId;
    private String refreshToken;
    private Instant expiresAt;
    private Instant lastRotatedAt;

    private AuthSession() {}

    public static AuthSession create(MemberId memberId, String refreshToken, Instant expiresAt) {
        AuthSession session = new AuthSession();
        session.memberId = memberId;
        session.refreshToken = refreshToken;
        session.expiresAt = expiresAt;
        session.lastRotatedAt = Instant.now();
        return session;
    }

    /** Redis에서 복원할 때 사용. lastRotatedAt이 null(구 엔티티)이면 EPOCH로 처리해 즉시 회전한다. */
    public static AuthSession reconstitute(MemberId memberId, String refreshToken, Instant expiresAt, Instant lastRotatedAt) {
        AuthSession session = new AuthSession();
        session.memberId = memberId;
        session.refreshToken = refreshToken;
        session.expiresAt = expiresAt;
        session.lastRotatedAt = lastRotatedAt != null ? lastRotatedAt : Instant.EPOCH;
        return session;
    }

    public boolean isExpired() {
        return Instant.now().isAfter(expiresAt);
    }

    /** 마지막 회전 후 interval 미만이면 true — 회전 없이 토큰 재사용 가능. */
    public boolean isRotatedRecently(Duration interval) {
        return Instant.now().isBefore(lastRotatedAt.plus(interval));
    }

    public void rotate(String newRefreshToken, Instant newExpiry) {
        this.refreshToken = newRefreshToken;
        this.expiresAt = newExpiry;
        this.lastRotatedAt = Instant.now();
    }

    public MemberId getMemberId() { return memberId; }
    public String getRefreshToken() { return refreshToken; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getLastRotatedAt() { return lastRotatedAt; }
}
