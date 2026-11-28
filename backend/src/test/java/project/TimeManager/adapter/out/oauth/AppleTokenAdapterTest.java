package project.TimeManager.adapter.out.oauth;

import org.jose4j.jwt.JwtClaims;
import org.jose4j.jwt.consumer.JwtConsumerBuilder;
import org.jose4j.jws.JsonWebSignature;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.spec.ECGenParameterSpec;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

@DisplayName("AppleTokenAdapter")
class AppleTokenAdapterTest {

    private static final Instant NOW = Instant.parse("2026-11-29T00:00:00Z");
    private static final String ENC_KEY = Base64.getEncoder().encodeToString(new byte[32]);

    private KeyPair keyPair;
    private String pem;
    private RestClient.Builder builder;
    private MockRestServiceServer server;

    @BeforeEach
    void setUp() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        keyPair = generator.generateKeyPair();
        pem = "-----BEGIN PRIVATE KEY-----\n"
                + Base64.getMimeEncoder(64, "\n".getBytes()).encodeToString(keyPair.getPrivate().getEncoded())
                + "\n-----END PRIVATE KEY-----\n";
        builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
    }

    private AppleTokenAdapter adapter(String pemValue) {
        return new AppleTokenAdapter("TEAM123456", "KEY1234567", pemValue, ENC_KEY, "com.mungji.timemanager",
                builder, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static Map<String, String> form(String body) {
        return Arrays.stream(body.split("&"))
                .map(kv -> kv.split("=", 2))
                .collect(Collectors.toMap(kv -> kv[0], kv -> URLDecoder.decode(kv[1], StandardCharsets.UTF_8)));
    }

    @Test
    @DisplayName("client secret 은 .p8 키로 ES256 서명되고 Apple 이 요구하는 iss·sub·aud·kid·짧은 만료를 갖는다")
    void clientSecretShape() throws Exception {
        String secret = adapter(pem).clientSecret();

        JsonWebSignature jws = new JsonWebSignature();
        jws.setCompactSerialization(secret);
        assertThat(jws.getAlgorithmHeaderValue()).isEqualTo("ES256");
        assertThat(jws.getKeyIdHeaderValue()).isEqualTo("KEY1234567");

        JwtClaims claims = new JwtConsumerBuilder()
                .setVerificationKey(keyPair.getPublic())
                .setExpectedAudience("https://appleid.apple.com")
                .setEvaluationTime(org.jose4j.jwt.NumericDate.fromSeconds(NOW.getEpochSecond()))
                .build()
                .processToClaims(secret);
        assertThat(claims.getIssuer()).isEqualTo("TEAM123456");
        assertThat(claims.getSubject()).isEqualTo("com.mungji.timemanager");
        assertThat(claims.getExpirationTime().getValue() - claims.getIssuedAt().getValue()).isEqualTo(300);
    }

    @Test
    @DisplayName("한 줄 시크릿(줄바꿈이 \\n 문자)으로 넣은 .p8 도 읽는다")
    void acceptsEscapedNewlines() {
        assertThat(adapter(pem.replace("\n", "\\n")).isEnabled()).isTrue();
    }

    @Test
    @DisplayName("code 를 교환해 refresh_token 을 돌려준다")
    void exchangesCode() {
        AtomicReference<String> body = new AtomicReference<>();
        server.expect(requestTo("https://appleid.apple.com/auth/token"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(req -> body.set(req.getBody() == null ? "" : ((org.springframework.mock.http.client.MockClientHttpRequest) req).getBodyAsString()))
                .andRespond(withSuccess("{\"access_token\":\"a\",\"refresh_token\":\"r.123\",\"id_token\":\"x\"}",
                        MediaType.APPLICATION_JSON));

        assertThat(adapter(pem).exchangeAuthorizationCode("c.abc")).contains("r.123");

        Map<String, String> sent = form(body.get());
        assertThat(sent).containsEntry("code", "c.abc")
                .containsEntry("grant_type", "authorization_code")
                .containsEntry("client_id", "com.mungji.timemanager")
                .containsKey("client_secret");
        server.verify();
    }

    @Test
    @DisplayName("Apple 이 code 를 거부하면(invalid_grant) 예외 없이 empty")
    void exchangeRejected() {
        server.expect(requestTo("https://appleid.apple.com/auth/token"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":\"invalid_grant\"}"));

        assertThat(adapter(pem).exchangeAuthorizationCode("used")).isEmpty();
    }

    @Test
    @DisplayName("revoke 는 refresh_token 힌트와 함께 보내고 200 이면 true, 오류면 false")
    void revoke() {
        AtomicReference<String> body = new AtomicReference<>();
        server.expect(requestTo("https://appleid.apple.com/auth/revoke"))
                .andExpect(req -> body.set(((org.springframework.mock.http.client.MockClientHttpRequest) req).getBodyAsString()))
                .andRespond(withSuccess());
        server.expect(requestTo("https://appleid.apple.com/auth/revoke"))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        AppleTokenAdapter adapter = adapter(pem);

        assertThat(adapter.revokeRefreshToken("r.123")).isTrue();
        assertThat(form(body.get())).containsEntry("token", "r.123").containsEntry("token_type_hint", "refresh_token");
        assertThat(adapter.revokeRefreshToken("r.123")).isFalse();
    }

    @Test
    @DisplayName("설정이 모두 비면 꺼지고 HTTP 를 부르지 않는다")
    void disabledWhenUnconfigured() {
        AppleTokenAdapter adapter = new AppleTokenAdapter("", "", "", "", "com.mungji.timemanager",
                builder, Clock.systemUTC());

        assertThat(adapter.isEnabled()).isFalse();
        assertThat(adapter.exchangeAuthorizationCode("c")).isEmpty();
        assertThat(adapter.revokeRefreshToken("r")).isFalse();
        server.verify();
    }

    @Test
    @DisplayName("일부만 설정됐거나 키가 깨졌으면 기동을 실패시킨다 — 조용히 꺼지지 않는다")
    void failsFastOnPartialOrBrokenConfig() {
        assertThatThrownBy(() -> new AppleTokenAdapter("TEAM", "KEY", pem, "", "com.mungji.timemanager",
                builder, Clock.systemUTC())).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> adapter("-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----"))
                .isInstanceOf(IllegalStateException.class);
    }
}
