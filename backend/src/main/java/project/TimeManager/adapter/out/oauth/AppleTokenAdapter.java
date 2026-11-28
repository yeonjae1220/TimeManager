package project.TimeManager.adapter.out.oauth;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.extern.slf4j.Slf4j;
import org.jose4j.jws.AlgorithmIdentifiers;
import org.jose4j.jws.JsonWebSignature;
import org.jose4j.jwt.JwtClaims;
import org.jose4j.jwt.NumericDate;
import org.jose4j.lang.JoseException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import project.TimeManager.domain.port.out.auth.AppleTokenPort;

import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * Apple 토큰 엔드포인트(/auth/token, /auth/revoke) 호출. 요청마다 .p8 키로 서명한 client secret(ES256 JWT)을 쓴다.
 *
 * <p>설정 네 개(팀 ID·키 ID·.p8 개인키·토큰 암호화 키)가 <b>모두 비어 있으면</b> 꺼진다 — 키를 만들기 전에도
 * 배포·로그인이 그대로 돌게. <b>일부만</b> 있으면 기동을 실패시킨다. 하나가 빠진 채 조용히 꺼지면 삭제한
 * 계정의 Apple 승인이 철회되지 않는데, 그건 로그로만 드러나 아무도 모른다.
 */
@Slf4j
@Component
public class AppleTokenAdapter implements AppleTokenPort {

    private static final String APPLE_BASE_URL = AppleIdentityTokenAdapter.ISSUER;
    private static final Duration CLIENT_SECRET_TTL = Duration.ofMinutes(5);
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(2);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(4);
    private static final int MAX_LOGGED_BODY = 200;

    private final String teamId;
    private final String keyId;
    private final String clientId;
    private final PrivateKey privateKey;
    private final RestClient restClient;
    private final Clock clock;

    @Autowired
    public AppleTokenAdapter(
            @Value("${apple.sign-in.team-id:}") String teamId,
            @Value("${apple.sign-in.key-id:}") String keyId,
            @Value("${apple.sign-in.private-key:}") String privateKeyPem,
            @Value("${apple.sign-in.token-encryption-key:}") String encryptionKey,
            @Value("${apple.sign-in.app-client-id:com.mungji.timemanager}") String clientId) {
        this(teamId, keyId, privateKeyPem, encryptionKey, clientId, defaultRestClient(), Clock.systemUTC());
    }

    AppleTokenAdapter(String teamId, String keyId, String privateKeyPem, String encryptionKey, String clientId,
                      RestClient.Builder restClientBuilder, Clock clock) {
        long configured = Stream.of(teamId, keyId, privateKeyPem, encryptionKey)
                .filter(v -> v != null && !v.isBlank())
                .count();
        if (configured != 0 && configured != 4) {
            throw new IllegalStateException("Apple 토큰 철회 설정이 일부만 있습니다 — APPLE_TEAM_ID·APPLE_KEY_ID·"
                    + "APPLE_PRIVATE_KEY·APPLE_TOKEN_ENCRYPTION_KEY 를 모두 넣거나 모두 비워 두세요");
        }
        boolean enabled = configured == 4;
        this.teamId = enabled ? teamId.strip() : null;
        this.keyId = enabled ? keyId.strip() : null;
        this.clientId = clientId.strip();
        this.privateKey = enabled ? parsePrivateKey(privateKeyPem) : null;
        this.restClient = restClientBuilder.baseUrl(APPLE_BASE_URL).build();
        this.clock = clock;
        log.info("apple.token revocation {}", enabled ? "enabled" : "disabled (키 미설정)");
    }

    private static RestClient.Builder defaultRestClient() {
        // 로그인 요청 스레드에서 부른다. 기본 타임아웃(무한)이면 Apple 이 느릴 때 스레드가 묶인다.
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(CONNECT_TIMEOUT);
        factory.setReadTimeout(READ_TIMEOUT);
        return RestClient.builder().requestFactory(factory);
    }

    /** .p8 파일 내용(PEM, PKCS#8). 시크릿에 한 줄로 넣느라 줄바꿈이 {@code \n} 문자로 들어와도 받는다. */
    static PrivateKey parsePrivateKey(String pem) {
        String base64 = pem.replace("\\n", "\n")
                .replaceAll("-----(BEGIN|END) [A-Z ]+-----", "")
                .replaceAll("\\s", "");
        try {
            return KeyFactory.getInstance("EC")
                    .generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(base64)));
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            // 원인 예외는 붙이지 않는다 — 메시지에 키 조각이 섞일 수 있다.
            throw new IllegalStateException("APPLE_PRIVATE_KEY 를 EC 개인키(.p8)로 읽지 못했습니다");
        }
    }

    @Override
    public boolean isEnabled() {
        return privateKey != null;
    }

    @Override
    public Optional<String> exchangeAuthorizationCode(String authorizationCode) {
        if (!isEnabled()) return Optional.empty();
        MultiValueMap<String, String> form = baseForm();
        form.add("code", authorizationCode);
        form.add("grant_type", "authorization_code");
        try {
            TokenResponse response = restClient.post()
                    .uri("/auth/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(TokenResponse.class);
            String refreshToken = response == null ? null : response.refreshToken();
            if (refreshToken == null || refreshToken.isBlank()) {
                log.warn("apple.token exchange returned no refresh_token");
                return Optional.empty();
            }
            return Optional.of(refreshToken);
        } catch (RestClientResponseException e) {
            log.warn("apple.token exchange rejected status={} body={}", e.getStatusCode().value(), truncate(e));
            return Optional.empty();
        } catch (RestClientException e) {
            log.warn("apple.token exchange failed: {}", e.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    @Override
    public boolean revokeRefreshToken(String refreshToken) {
        if (!isEnabled()) return false;
        MultiValueMap<String, String> form = baseForm();
        form.add("token", refreshToken);
        form.add("token_type_hint", "refresh_token");
        try {
            restClient.post()
                    .uri("/auth/revoke")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (RestClientResponseException e) {
            log.warn("apple.token revoke rejected status={} body={}", e.getStatusCode().value(), truncate(e));
            return false;
        } catch (RestClientException e) {
            log.warn("apple.token revoke failed: {}", e.getClass().getSimpleName());
            return false;
        }
    }

    private MultiValueMap<String, String> baseForm() {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret());
        return form;
    }

    /** Apple 문서의 client secret 형식: iss=팀 ID, sub=client_id, aud=appleid.apple.com, 헤더 kid=키 ID. */
    String clientSecret() {
        long now = clock.instant().getEpochSecond();
        JwtClaims claims = new JwtClaims();
        claims.setIssuer(teamId);
        claims.setSubject(clientId);
        claims.setAudience(APPLE_BASE_URL);
        claims.setIssuedAt(NumericDate.fromSeconds(now));
        claims.setExpirationTime(NumericDate.fromSeconds(now + CLIENT_SECRET_TTL.toSeconds()));

        JsonWebSignature jws = new JsonWebSignature();
        jws.setPayload(claims.toJson());
        jws.setKey(privateKey);
        jws.setKeyIdHeaderValue(keyId);
        jws.setAlgorithmHeaderValue(AlgorithmIdentifiers.ECDSA_USING_P256_CURVE_AND_SHA256);
        try {
            return jws.getCompactSerialization();
        } catch (JoseException e) {
            throw new IllegalStateException("Apple client secret 서명 실패", e);
        }
    }

    /** Apple 오류 본문은 {"error":"invalid_grant"} 같은 짧은 코드다. 그래도 길이를 자른다. */
    private static String truncate(RestClientResponseException e) {
        String body = e.getResponseBodyAsString();
        return body.length() <= MAX_LOGGED_BODY ? body : body.substring(0, MAX_LOGGED_BODY);
    }

    private record TokenResponse(@JsonProperty("refresh_token") String refreshToken) {}
}
