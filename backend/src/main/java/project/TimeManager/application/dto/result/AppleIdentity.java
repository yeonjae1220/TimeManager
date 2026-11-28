package project.TimeManager.application.dto.result;

import java.time.Instant;

/**
 * 검증을 마친 Apple identity token 의 신원. email 은 사용자가 가린 경우 릴레이 주소다.
 * expiresAt 은 토큰의 exp — 재사용 방지 기록을 언제까지 둘지 정한다.
 */
public record AppleIdentity(String subject, String email, boolean emailVerified, Instant expiresAt) {}
