package project.TimeManager.adapter.out.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("AppleRefreshTokenCipher")
class AppleRefreshTokenCipherTest {

    private static final String KEY = Base64.getEncoder().encodeToString(new byte[32]);
    private static final String OTHER_KEY = Base64.getEncoder().encodeToString("0123456789abcdef0123456789abcdef".getBytes());

    @Test
    @DisplayName("암호화한 값을 같은 회원으로 복호화하면 원문이 나오고, 암호문에는 원문이 없다")
    void roundTrip() {
        AppleRefreshTokenCipher cipher = new AppleRefreshTokenCipher(KEY);

        String stored = cipher.encrypt(7L, "r.apple-refresh-token");

        assertThat(stored).startsWith("v1.").doesNotContain("apple-refresh-token");
        assertThat(cipher.decrypt(7L, stored)).isEqualTo("r.apple-refresh-token");
    }

    @Test
    @DisplayName("같은 원문도 매번 다른 암호문이 된다(IV 재사용 없음)")
    void randomIv() {
        AppleRefreshTokenCipher cipher = new AppleRefreshTokenCipher(KEY);

        assertThat(cipher.encrypt(7L, "same")).isNotEqualTo(cipher.encrypt(7L, "same"));
    }

    @Test
    @DisplayName("다른 회원 행으로 옮긴 암호문은 복호화되지 않는다(회원 ID 가 AAD)")
    void boundToMember() {
        AppleRefreshTokenCipher cipher = new AppleRefreshTokenCipher(KEY);
        String stored = cipher.encrypt(7L, "token");

        assertThatThrownBy(() -> cipher.decrypt(8L, stored)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("키가 바뀌거나 암호문이 변조되면 복호화가 실패한다")
    void rejectsWrongKeyAndTampering() {
        String stored = new AppleRefreshTokenCipher(KEY).encrypt(7L, "token");
        char last = stored.charAt(stored.length() - 1);
        String tampered = stored.substring(0, stored.length() - 1) + (last == 'A' ? 'B' : 'A');

        assertThatThrownBy(() -> new AppleRefreshTokenCipher(OTHER_KEY).decrypt(7L, stored))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new AppleRefreshTokenCipher(KEY).decrypt(7L, tampered))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("키가 비어 있으면 꺼진다. 값이 있는데 32바이트 base64 가 아니면 기동을 실패시킨다")
    void keyValidation() {
        assertThat(new AppleRefreshTokenCipher("").isEnabled()).isFalse();
        assertThat(new AppleRefreshTokenCipher(KEY).isEnabled()).isTrue();
        assertThatThrownBy(() -> new AppleRefreshTokenCipher("not base64!"))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new AppleRefreshTokenCipher(Base64.getEncoder().encodeToString(new byte[16])))
                .isInstanceOf(IllegalStateException.class);
    }
}
