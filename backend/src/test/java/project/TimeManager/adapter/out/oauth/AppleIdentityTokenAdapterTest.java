package project.TimeManager.adapter.out.oauth;

import org.jose4j.jwk.RsaJsonWebKey;
import org.jose4j.jwk.RsaJwkGenerator;
import org.jose4j.jws.AlgorithmIdentifiers;
import org.jose4j.jws.JsonWebSignature;
import org.jose4j.jwt.JwtClaims;
import org.jose4j.jwt.NumericDate;
import org.jose4j.keys.resolvers.JwksVerificationKeyResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import project.TimeManager.application.dto.result.AppleIdentity;
import project.TimeManager.domain.exception.DomainException;

import java.util.List;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("AppleIdentityTokenAdapter")
class AppleIdentityTokenAdapterTest {

    private static final String BUNDLE_ID = "com.mungji.timemanager";
    private static final String RAW_NONCE = "raw-nonce-123";

    private RsaJsonWebKey appleKey;
    private AppleIdentityTokenAdapter adapter;

    @BeforeEach
    void setUp() throws Exception {
        appleKey = RsaJwkGenerator.generateJwk(2048);
        appleKey.setKeyId("apple-kid");
        adapter = new AppleIdentityTokenAdapter(new JwksVerificationKeyResolver(List.of(appleKey)), BUNDLE_ID);
    }

    private String token(RsaJsonWebKey key, Consumer<JwtClaims> customize) throws Exception {
        JwtClaims claims = new JwtClaims();
        claims.setIssuer(AppleIdentityTokenAdapter.ISSUER);
        claims.setAudience(BUNDLE_ID);
        claims.setSubject("001234.abc");
        claims.setExpirationTimeMinutesInTheFuture(5);
        claims.setIssuedAtToNow();
        claims.setClaim("nonce", AppleIdentityTokenAdapter.sha256Hex(RAW_NONCE));
        claims.setClaim("email", "x7@privaterelay.appleid.com");
        claims.setClaim("email_verified", "true");
        customize.accept(claims);

        JsonWebSignature jws = new JsonWebSignature();
        jws.setPayload(claims.toJson());
        jws.setKey(key.getPrivateKey());
        jws.setKeyIdHeaderValue(key.getKeyId());
        jws.setAlgorithmHeaderValue(AlgorithmIdentifiers.RSA_USING_SHA256);
        return jws.getCompactSerialization();
    }

    @Test
    @DisplayName("Apple 키로 서명되고 nonce 가 맞는 토큰에서 신원을 꺼낸다")
    void acceptsValidToken() throws Exception {
        AppleIdentity identity = adapter.verify(token(appleKey, c -> {}), RAW_NONCE);

        assertThat(identity.subject()).isEqualTo("001234.abc");
        assertThat(identity.email()).isEqualTo("x7@privaterelay.appleid.com");
        assertThat(identity.emailVerified()).isTrue();
    }

    @Test
    @DisplayName("email_verified 가 boolean 으로 와도 읽는다")
    void acceptsBooleanEmailVerified() throws Exception {
        AppleIdentity identity = adapter.verify(token(appleKey, c -> c.setClaim("email_verified", true)), RAW_NONCE);

        assertThat(identity.emailVerified()).isTrue();
    }

    @Test
    @DisplayName("다른 키로 서명된 토큰은 거부한다")
    void rejectsForeignSignature() throws Exception {
        RsaJsonWebKey attacker = RsaJwkGenerator.generateJwk(2048);
        attacker.setKeyId("apple-kid");

        String forged = token(attacker, c -> {});
        assertThatThrownBy(() -> adapter.verify(forged, RAW_NONCE)).isInstanceOf(DomainException.class);
    }

    @Test
    @DisplayName("다른 앱(audience)에 발급된 토큰은 거부한다")
    void rejectsOtherAudience() throws Exception {
        String other = token(appleKey, c -> c.setAudience("com.evil.app"));
        assertThatThrownBy(() -> adapter.verify(other, RAW_NONCE)).isInstanceOf(DomainException.class);
    }

    @Test
    @DisplayName("발급자가 Apple 이 아니면 거부한다")
    void rejectsOtherIssuer() throws Exception {
        String other = token(appleKey, c -> c.setIssuer("https://evil.example"));
        assertThatThrownBy(() -> adapter.verify(other, RAW_NONCE)).isInstanceOf(DomainException.class);
    }

    @Test
    @DisplayName("만료된 토큰은 거부한다")
    void rejectsExpired() throws Exception {
        String expired = token(appleKey, c -> c.setExpirationTime(NumericDate.fromSeconds(NumericDate.now().getValue() - 600)));
        assertThatThrownBy(() -> adapter.verify(expired, RAW_NONCE)).isInstanceOf(DomainException.class);
    }

    @Test
    @DisplayName("nonce 원문이 다르거나 없으면 거부한다 — 탈취한 토큰의 재사용 차단")
    void rejectsNonceMismatch() throws Exception {
        String valid = token(appleKey, c -> {});
        assertThatThrownBy(() -> adapter.verify(valid, "other-nonce")).isInstanceOf(DomainException.class);
        assertThatThrownBy(() -> adapter.verify(valid, null)).isInstanceOf(DomainException.class);

        String noNonce = token(appleKey, c -> c.unsetClaim("nonce"));
        assertThatThrownBy(() -> adapter.verify(noNonce, RAW_NONCE)).isInstanceOf(DomainException.class);
    }

    @Test
    @DisplayName("허용 대상 목록이 비어 있으면 기동을 막는다")
    void rejectsEmptyClientIds() {
        assertThatThrownBy(() -> new AppleIdentityTokenAdapter(new JwksVerificationKeyResolver(List.of(appleKey)), " , "))
                .isInstanceOf(IllegalStateException.class);
    }
}
