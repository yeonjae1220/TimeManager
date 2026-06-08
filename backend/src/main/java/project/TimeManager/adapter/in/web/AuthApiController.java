package project.TimeManager.adapter.in.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.web.bind.annotation.*;
import project.TimeManager.shared.security.RateLimiterService;
import project.TimeManager.adapter.in.web.dto.request.GoogleLoginRequest;
import project.TimeManager.adapter.in.web.dto.request.LoginRequest;
import project.TimeManager.adapter.in.web.dto.response.GoogleAuthResponse;
import project.TimeManager.adapter.in.web.dto.response.LoginResponse;
import project.TimeManager.application.dto.command.auth.GoogleLoginCommand;
import project.TimeManager.application.dto.command.auth.LoginCommand;
import project.TimeManager.application.dto.command.auth.LogoutCommand;
import project.TimeManager.application.dto.command.auth.RefreshTokenCommand;
import project.TimeManager.application.dto.result.GoogleLoginResult;
import project.TimeManager.application.dto.result.TokenPairResult;
import project.TimeManager.domain.port.in.auth.GoogleLoginUseCase;
import project.TimeManager.domain.port.in.auth.LoginUseCase;
import project.TimeManager.domain.port.in.auth.LogoutUseCase;
import project.TimeManager.domain.port.in.auth.RefreshTokenUseCase;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthApiController {

    private static final String REFRESH_COOKIE_NAME = "refresh_token";
    private static final long REFRESH_COOKIE_MAX_AGE = 30L * 24 * 60 * 60;

    private final LoginUseCase loginUseCase;
    private final RefreshTokenUseCase refreshTokenUseCase;
    private final LogoutUseCase logoutUseCase;
    private final GoogleLoginUseCase googleLoginUseCase;
    private final RateLimiterService rateLimiterService;
    private final Environment environment;
    private final List<IpAddressMatcher> trustedProxyMatchers;

    public AuthApiController(
            LoginUseCase loginUseCase,
            RefreshTokenUseCase refreshTokenUseCase,
            LogoutUseCase logoutUseCase,
            GoogleLoginUseCase googleLoginUseCase,
            RateLimiterService rateLimiterService,
            Environment environment,
            @Value("${app.trusted-proxy-ips:127.0.0.1,::1}") String trustedProxyIpsConfig
    ) {
        this.loginUseCase = loginUseCase;
        this.refreshTokenUseCase = refreshTokenUseCase;
        this.logoutUseCase = logoutUseCase;
        this.googleLoginUseCase = googleLoginUseCase;
        this.rateLimiterService = rateLimiterService;
        this.environment = environment;
        this.trustedProxyMatchers = Arrays.stream(trustedProxyIpsConfig.split(","))
                .map(String::trim)
                .filter(ip -> !ip.isEmpty())
                .map(AuthApiController::parseMatcher)
                .toList();
    }

    private static IpAddressMatcher parseMatcher(String ip) {
        try {
            return new IpAddressMatcher(ip);
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("app.trusted-proxy-ips에 잘못된 IP/CIDR 항목이 있습니다: " + ip, e);
        }
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse response) {
        rateLimiterService.checkLoginRate(getClientIp(httpRequest));
        TokenPairResult result = loginUseCase.login(new LoginCommand(request.email(), request.password()));
        addRefreshCookie(response, result.refreshToken());
        return ResponseEntity.ok(new LoginResponse(result.accessToken(), result.memberId()));
    }

    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refresh(
            @CookieValue(name = REFRESH_COOKIE_NAME, required = false) String refreshToken,
            HttpServletRequest httpRequest,
            HttpServletResponse response) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.status(401).build();
        }
        rateLimiterService.checkRefreshRate(getClientIp(httpRequest));
        TokenPairResult result = refreshTokenUseCase.refresh(new RefreshTokenCommand(refreshToken));
        addRefreshCookie(response, result.refreshToken());
        return ResponseEntity.ok(new LoginResponse(result.accessToken(), result.memberId()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = REFRESH_COOKIE_NAME, required = false) String refreshToken,
            HttpServletResponse response) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            logoutUseCase.logout(new LogoutCommand(refreshToken));
        }
        clearRefreshCookie(response);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/google")
    public ResponseEntity<GoogleAuthResponse> googleLogin(
            @Valid @RequestBody GoogleLoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse response) {
        rateLimiterService.checkLoginRate(getClientIp(httpRequest));
        GoogleLoginResult result = googleLoginUseCase.loginWithGoogle(
                new GoogleLoginCommand(request.code(), request.redirectUri()));
        addRefreshCookie(response, result.refreshToken());
        return ResponseEntity.ok(new GoogleAuthResponse(result.accessToken(), result.memberId(), result.newMember()));
    }

    /**
     * 신뢰 프록시(nginx-ingress 등) IP/CIDR 대역에서 온 요청만 X-Forwarded-For 헤더를 신뢰.
     * 그렇지 않으면 클라이언트가 임의의 X-Forwarded-For 값을 보내 IP 기반 rate limit을 우회할 수 있음.
     */
    private String getClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (isTrustedProxy(remoteAddr)) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                return resolveFromChain(forwarded);
            }
        }
        return remoteAddr;
    }

    /**
     * X-Forwarded-For는 각 홉이 자신을 덧붙이는 방식으로 누적될 수 있어(use-forwarded-headers: true 등),
     * 가장 왼쪽 값은 클라이언트가 임의로 주입할 수 있다.
     * 오른쪽부터 훑어 신뢰 프록시가 아닌 첫 항목을 실제 클라이언트 IP로 본다.
     */
    private String resolveFromChain(String forwarded) {
        String[] ips = forwarded.split(",");
        for (int i = ips.length - 1; i >= 0; i--) {
            String candidate = ips[i].trim();
            if (!candidate.isEmpty() && !isTrustedProxy(candidate)) {
                return candidate;
            }
        }
        return ips[0].trim();
    }

    private boolean isTrustedProxy(String remoteAddr) {
        return trustedProxyMatchers.stream().anyMatch(matcher -> matcher.matches(remoteAddr));
    }

    private void addRefreshCookie(HttpServletResponse response, String refreshToken) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE_NAME, refreshToken)
                .httpOnly(true)
                .secure(isSecureCookieRequired())
                .sameSite("Lax")
                .maxAge(REFRESH_COOKIE_MAX_AGE)
                .path("/api/v1/auth")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE_NAME, "")
                .httpOnly(true)
                .secure(isSecureCookieRequired())
                .sameSite("Lax")
                .maxAge(0)
                .path("/api/v1/auth")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private boolean isSecureCookieRequired() {
        return Arrays.stream(environment.getActiveProfiles())
                .noneMatch(p -> p.equalsIgnoreCase("local") || p.equalsIgnoreCase("test"));
    }
}
