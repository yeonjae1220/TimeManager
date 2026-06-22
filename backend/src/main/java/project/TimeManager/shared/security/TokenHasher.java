package project.TimeManager.shared.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Objects;

/**
 * One-way SHA-256 hashing for high-entropy secrets (e.g. refresh tokens).
 *
 * <p>Refresh tokens are cryptographically random and high-entropy, so a single
 * unsalted SHA-256 pass is sufficient to make a Redis dump unusable for session
 * hijacking — a slow KDF such as bcrypt is unnecessary (and would prevent the
 * O(1) keyed lookup the token store relies on). See GLOBAL-PIT-001.
 */
public final class TokenHasher {

    private static final HexFormat HEX = HexFormat.of();

    private TokenHasher() {
    }

    public static String sha256(String value) {
        Objects.requireNonNull(value, "value to hash must not be null");
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HEX.formatHex(hashed);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is mandated by every JVM; absence is unrecoverable.
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }
}
