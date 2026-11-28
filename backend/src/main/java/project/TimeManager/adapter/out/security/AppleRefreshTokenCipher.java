package project.TimeManager.adapter.out.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Apple refresh token 을 DB 에 넣기 전에 AES-256-GCM 으로 암호화한다.
 *
 * <p>회원 ID 를 AAD 로 묶는다 — DB 를 고칠 수 있는 사람이 암호문을 다른 회원 행으로 옮겨도
 * 복호화가 실패한다. 형식: {@code v1.} + base64url(IV 12바이트 ‖ 암호문 ‖ 태그 16바이트).
 *
 * <p>키(32바이트, base64)가 없으면 {@link #isEnabled()} 가 false 다. 값이 있는데 형식이 틀리면
 * 기동을 실패시킨다 — 조용히 꺼지면 철회가 안 되는 걸 아무도 모른다.
 */
@Component
public class AppleRefreshTokenCipher {

    private static final String PREFIX = "v1.";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int KEY_BYTES = 32;
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public AppleRefreshTokenCipher(@Value("${apple.sign-in.token-encryption-key:}") String base64Key) {
        this.key = parseKey(base64Key);
    }

    private static SecretKeySpec parseKey(String base64Key) {
        if (base64Key == null || base64Key.isBlank()) return null;
        byte[] raw;
        try {
            raw = Base64.getDecoder().decode(base64Key.strip());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("apple.sign-in.token-encryption-key 는 base64 여야 합니다");
        }
        if (raw.length != KEY_BYTES) {
            throw new IllegalStateException("apple.sign-in.token-encryption-key 는 32바이트(base64)여야 합니다");
        }
        return new SecretKeySpec(raw, "AES");
    }

    public boolean isEnabled() {
        return key != null;
    }

    public String encrypt(Long memberId, String plaintext) {
        requireKey();
        byte[] iv = new byte[IV_BYTES];
        random.nextBytes(iv);
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            cipher.updateAAD(aad(memberId));
            byte[] sealed = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] out = ByteBuffer.allocate(iv.length + sealed.length).put(iv).put(sealed).array();
            return PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(out);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Apple refresh token 암호화 실패", e);
        }
    }

    /** @throws IllegalStateException 키가 다르거나, 다른 회원의 암호문이거나, 변조됐을 때 */
    public String decrypt(Long memberId, String stored) {
        requireKey();
        if (stored == null || !stored.startsWith(PREFIX)) {
            throw new IllegalStateException("알 수 없는 Apple refresh token 형식");
        }
        try {
            byte[] in = Base64.getUrlDecoder().decode(stored.substring(PREFIX.length()));
            if (in.length <= IV_BYTES) throw new IllegalStateException("Apple refresh token 암호문이 너무 짧습니다");
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, in, 0, IV_BYTES));
            cipher.updateAAD(aad(memberId));
            byte[] plain = cipher.doFinal(in, IV_BYTES, in.length - IV_BYTES);
            return new String(plain, StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException("Apple refresh token 복호화 실패", e);
        }
    }

    private void requireKey() {
        if (key == null) throw new IllegalStateException("apple.sign-in.token-encryption-key 가 설정되지 않았습니다");
    }

    private static byte[] aad(Long memberId) {
        return ("apple-refresh-token:" + memberId).getBytes(StandardCharsets.UTF_8);
    }
}
