package project.TimeManager.adapter.in.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.querydsl.jpa.impl.JPAQueryFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import project.TimeManager.adapter.in.web.dto.request.LoginRequest;
import project.TimeManager.adapter.in.web.security.JwtTokenProvider;
import project.TimeManager.application.dto.result.TokenPairResult;
import project.TimeManager.domain.port.in.auth.GoogleLoginUseCase;
import project.TimeManager.domain.port.in.auth.LoginUseCase;
import project.TimeManager.domain.port.in.auth.LogoutUseCase;
import project.TimeManager.domain.port.in.auth.RefreshTokenUseCase;
import project.TimeManager.shared.config.SecurityConfig;
import project.TimeManager.shared.security.RateLimiterService;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AuthApiController의 클라이언트 IP 추출(getClientIp) 신뢰 프록시 검증 테스트.
 * X-Forwarded-For 스푸핑으로 IP 기반 rate limit을 우회할 수 없는지 확인한다.
 */
@WebMvcTest(controllers = AuthApiController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = SecurityConfig.class))
@AutoConfigureMockMvc(addFilters = false)
@TestPropertySource(properties = "app.trusted-proxy-ips=10.0.0.1")
class AuthApiControllerTest {

    private static final String LOGIN_URL = "/api/v1/auth/login";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private LoginUseCase loginUseCase;

    @MockBean
    private RefreshTokenUseCase refreshTokenUseCase;

    @MockBean
    private LogoutUseCase logoutUseCase;

    @MockBean
    private GoogleLoginUseCase googleLoginUseCase;

    @MockBean
    private RateLimiterService rateLimiterService; // Redis 없이 테스트 — IP 인자 캡처용

    @MockBean
    private JwtTokenProvider jwtTokenProvider; // JwtAuthenticationFilter(@Component)가 슬라이스 컨텍스트에 포함되어 의존성 필요

    @MockBean
    private JPAQueryFactory jpaQueryFactory; // TimeManagerApplication의 @Bean이 EntityManager를 요구해 슬라이스에서 깨지는 것 방지

    @Test
    @DisplayName("신뢰되지 않은 피어가 보낸 X-Forwarded-For는 무시하고 실제 TCP 피어 주소로 rate limit을 검사한다")
    void login_untrustedPeer_ignoresForwardedHeader() throws Exception {
        given(loginUseCase.login(any())).willReturn(new TokenPairResult("access", "refresh", 1L));

        mockMvc.perform(loginRequestFrom("203.0.113.9", "1.1.1.1"))
                .andExpect(status().isOk());

        verify(rateLimiterService).checkLoginRate(eq("203.0.113.9"));
    }

    @Test
    @DisplayName("공격자가 매 요청 다른 X-Forwarded-For 값을 보내도 신뢰되지 않은 피어라면 동일한 실제 IP로 카운트된다 (스푸핑 우회 차단)")
    void login_spoofedForwardedHeaderVariesPerRequest_stillCountsRealPeerIp() throws Exception {
        given(loginUseCase.login(any())).willReturn(new TokenPairResult("access", "refresh", 1L));

        mockMvc.perform(loginRequestFrom("203.0.113.9", "9.9.9.1")).andExpect(status().isOk());
        mockMvc.perform(loginRequestFrom("203.0.113.9", "9.9.9.2")).andExpect(status().isOk());
        mockMvc.perform(loginRequestFrom("203.0.113.9", "9.9.9.3")).andExpect(status().isOk());

        // 세 요청 모두 동일한 실제 피어 IP로 rate limit이 적용되어야 함 — 위조된 값으로 분산되면 안 됨
        verify(rateLimiterService, org.mockito.Mockito.times(3)).checkLoginRate(eq("203.0.113.9"));
    }

    @Test
    @DisplayName("신뢰 프록시(allowlist에 등록된 피어)에서 온 요청은 X-Forwarded-For의 실제 클라이언트 IP를 사용한다")
    void login_trustedProxyPeer_usesForwardedHeaderClientIp() throws Exception {
        given(loginUseCase.login(any())).willReturn(new TokenPairResult("access", "refresh", 1L));

        mockMvc.perform(loginRequestFrom("10.0.0.1", "198.51.100.7"))
                .andExpect(status().isOk());

        verify(rateLimiterService).checkLoginRate(eq("198.51.100.7"));
    }

    private MockHttpServletRequestBuilder loginRequestFrom(String remoteAddr, String forwardedFor) throws Exception {
        LoginRequest request = new LoginRequest("user@example.com", "Password123!");
        return post(LOGIN_URL)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Forwarded-For", forwardedFor)
                .content(objectMapper.writeValueAsString(request))
                .with(req -> {
                    req.setRemoteAddr(remoteAddr);
                    return req;
                });
    }
}
