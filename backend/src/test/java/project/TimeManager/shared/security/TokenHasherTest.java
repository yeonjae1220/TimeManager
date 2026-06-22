package project.TimeManager.shared.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TokenHasherTest {

    @Test
    @DisplayName("sha256 produces the known hex digest for a reference vector")
    void sha256_knownVector_returnsExpectedDigest() {
        // SHA-256("abc") reference vector
        assertThat(TokenHasher.sha256("abc"))
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }

    @Test
    @DisplayName("sha256 output is 64 lowercase hex chars")
    void sha256_anyInput_is64HexChars() {
        String digest = TokenHasher.sha256("some-high-entropy-refresh-token");

        assertThat(digest).hasSize(64).matches("[0-9a-f]{64}");
    }

    @Test
    @DisplayName("sha256 is deterministic for the same input")
    void sha256_sameInput_sameDigest() {
        assertThat(TokenHasher.sha256("token-x")).isEqualTo(TokenHasher.sha256("token-x"));
    }

    @Test
    @DisplayName("sha256 differs for different inputs")
    void sha256_differentInput_differentDigest() {
        assertThat(TokenHasher.sha256("token-a")).isNotEqualTo(TokenHasher.sha256("token-b"));
    }

    @Test
    @DisplayName("sha256 never returns the plaintext input")
    void sha256_neverReturnsPlaintext() {
        String token = "plaintext-refresh-token";

        assertThat(TokenHasher.sha256(token)).isNotEqualTo(token);
    }

    @Test
    @DisplayName("sha256 rejects null input")
    void sha256_null_throws() {
        assertThatThrownBy(() -> TokenHasher.sha256(null))
                .isInstanceOf(NullPointerException.class);
    }
}
