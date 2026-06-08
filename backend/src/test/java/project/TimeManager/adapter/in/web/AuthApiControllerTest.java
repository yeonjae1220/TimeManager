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
import org.springframework.test.web.servlet.MockMvc;
import project.TimeManager.adapter.in.web.dto.request.LoginRequest;
import project.TimeManager.adapter.in.web.security.JwtTokenProvider;
import project.TimeManager.application.dto.result.TokenPairResult;
import project.TimeManager.domain.port.in.auth.GoogleLoginUseCase;
import project.TimeManager.domain.port.in.auth.LoginUseCase;
import project.TimeManager.domain.port.in.auth.LogoutUseCase;
import project.TimeManager.domain.port.in.auth.RefreshTokenUseCase;
import project.TimeManager.shared.config.SecurityConfig;
import project.TimeManager.shared.security.ClientIpResolver;
import project.TimeManager.shared.security.RateLimiterService;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AuthApiController가 ClientIpResolver로 추출한 클라이언트 IP를
 * RateLimiterService에 올바른 차원(IP, IP+이메일)으로 위임하는지 검증한다.
 * IP 추출 자체의 신뢰 프록시 로직은 ClientIpResolverTest가 담당한다.
 */
@WebMvcTest(controllers = AuthApiController.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = SecurityConfig.class))
@AutoConfigureMockMvc(addFilters = false)
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
    private RateLimiterService rateLimiterService; // Redis 없이 테스트 — 위임 인자 캡처용

    @MockBean
    private ClientIpResolver clientIpResolver; // IP 추출 로직은 별도 단위 테스트(ClientIpResolverTest)가 검증

    @MockBean
    private JwtTokenProvider jwtTokenProvider; // JwtAuthenticationFilter(@Component)가 슬라이스 컨텍스트에 포함되어 의존성 필요

    @MockBean
    private JPAQueryFactory jpaQueryFactory; // TimeManagerApplication의 @Bean이 EntityManager를 요구해 슬라이스에서 깨지는 것 방지

    @Test
    @DisplayName("로그인: ClientIpResolver가 추출한 IP와 요청 이메일을 함께 rate limit에 위임한다")
    void login_delegatesResolvedIpAndEmailToRateLimiter() throws Exception {
        given(clientIpResolver.resolve(any())).willReturn("203.0.113.9");
        given(loginUseCase.login(any())).willReturn(new TokenPairResult("access", "refresh", 1L));

        LoginRequest request = new LoginRequest("user@example.com", "Password123!");
        mockMvc.perform(post(LOGIN_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        verify(rateLimiterService).checkLoginRate(eq("203.0.113.9"), eq("user@example.com"));
    }
}
