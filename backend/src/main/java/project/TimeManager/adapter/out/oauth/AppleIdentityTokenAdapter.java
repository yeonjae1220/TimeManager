package project.TimeManager.adapter.out.oauth;

import lombok.extern.slf4j.Slf4j;
import org.jose4j.http.Get;
import org.jose4j.jwa.AlgorithmConstraints;
import org.jose4j.jwk.HttpsJwks;
import org.jose4j.jws.AlgorithmIdentifiers;
import org.jose4j.jwt.JwtClaims;
import org.jose4j.jwt.MalformedClaimException;
import org.jose4j.jwt.consumer.InvalidJwtException;
import org.jose4j.jwt.consumer.JwtConsumer;
import org.jose4j.jwt.consumer.JwtConsumerBuilder;
import org.jose4j.keys.resolvers.HttpsJwksVerificationKeyResolver;
import org.jose4j.keys.resolvers.VerificationKeyResolver;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import project.TimeManager.application.dto.result.AppleIdentity;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.port.out.auth.AppleIdentityTokenPort;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.HexFormat;

/**
 * Apple identity token(JWT) 검증. 서버 간 code 교환(.p8 client secret)은 하지 않는다 —
 * 로그인 판단에 필요한 신원은 서명된 identity token 에 전부 있다.
 *
 * nonce: 앱이 원문 nonce 의 SHA-256(hex)을 Apple 에 넘기고, Apple 은 그 값을 토큰의 nonce 클레임에
 * 그대로 싣는다. 서버는 원문을 받아 같은 해시를 만들어 비교한다 — 탈취한 토큰을 다른 요청에
 * 재사용하려면 원문까지 알아야 한다.
 */
@Slf4j
@Component
public class AppleIdentityTokenAdapter implements AppleIdentityTokenPort {

    static final String ISSUER = "https://appleid.apple.com";
    private static final String JWKS_URL = ISSUER + "/auth/keys";
    private static final int CLOCK_SKEW_SECONDS = 30;
    private static final int JWKS_CONNECT_TIMEOUT_MS = 2_000;
    private static final int JWKS_READ_TIMEOUT_MS = 3_000;

    private final JwtConsumer consumer;

    @Autowired
    public AppleIdentityTokenAdapter(@Value("${apple.sign-in.client-ids:com.mungji.timemanager}") String clientIds) {
        this(new HttpsJwksVerificationKeyResolver(appleJwks()), clientIds);
    }

    /**
     * 기본 타임아웃(약 20초)을 쓰면 Apple 이 느릴 때 요청 스레드가 그만큼 묶인다. 키 목록은 작고
     * 캐시되므로 짧게 끊고 실패시킨다 — 로그인 실패 한 번이 스레드 고갈보다 낫다.
     */
    private static HttpsJwks appleJwks() {
        Get get = new Get();
        get.setConnectTimeout(JWKS_CONNECT_TIMEOUT_MS);
        get.setReadTimeout(JWKS_READ_TIMEOUT_MS);
        HttpsJwks jwks = new HttpsJwks(JWKS_URL);
        jwks.setSimpleHttpGet(get);
        return jwks;
    }

    AppleIdentityTokenAdapter(VerificationKeyResolver keyResolver, String clientIds) {
        String[] audiences = Arrays.stream(clientIds.split(","))
                .map(String::strip)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);
        if (audiences.length == 0) {
            throw new IllegalStateException("apple.sign-in.client-ids 가 비어 있습니다");
        }
        this.consumer = new JwtConsumerBuilder()
                .setRequireExpirationTime()
                .setRequireSubject()
                .setAllowedClockSkewInSeconds(CLOCK_SKEW_SECONDS)
                .setExpectedIssuer(ISSUER)
                .setExpectedAudience(audiences)
                .setVerificationKeyResolver(keyResolver)
                .setJwsAlgorithmConstraints(AlgorithmConstraints.ConstraintType.PERMIT, AlgorithmIdentifiers.RSA_USING_SHA256)
                .build();
    }

    @Override
    public AppleIdentity verify(String identityToken, String rawNonce) {
        JwtClaims claims;
        try {
            claims = consumer.processToClaims(identityToken);
        } catch (InvalidJwtException e) {
            // 토큰 원문·클레임은 남기지 않는다(신원 정보). 원인 분류만 남긴다.
            log.info("auth.apple.fail reason=invalid_token detail={}", e.getErrorDetails().isEmpty()
                    ? "unknown" : e.getErrorDetails().get(0).getErrorCode());
            throw new DomainException("Apple 로그인 토큰이 유효하지 않습니다");
        }

        try {
            String nonce = claims.getStringClaimValue("nonce");
            if (nonce == null || rawNonce == null || !MessageDigest.isEqual(
                    nonce.getBytes(StandardCharsets.UTF_8), sha256Hex(rawNonce).getBytes(StandardCharsets.UTF_8))) {
                log.info("auth.apple.fail reason=nonce_mismatch");
                throw new DomainException("Apple 로그인 토큰이 유효하지 않습니다");
            }
            return new AppleIdentity(claims.getSubject(), claims.getStringClaimValue("email"),
                    isTrue(claims.getClaimValue("email_verified")));
        } catch (MalformedClaimException e) {
            log.info("auth.apple.fail reason=malformed_claim");
            throw new DomainException("Apple 로그인 토큰이 유효하지 않습니다");
        }
    }

    /** Apple 은 email_verified 를 boolean 으로도, "true" 문자열로도 보낸다. */
    private static boolean isTrue(Object value) {
        return Boolean.TRUE.equals(value) || "true".equals(value);
    }

    static String sha256Hex(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 을 쓸 수 없습니다", e);
        }
    }
}
