package project.TimeManager.adapter.in.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import project.TimeManager.shared.security.ClientIpResolver;
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
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.port.in.auth.GoogleLoginUseCase;
import project.TimeManager.domain.port.in.auth.LoginUseCase;
import project.TimeManager.domain.port.in.auth.LogoutUseCase;
import project.TimeManager.domain.port.in.auth.RefreshTokenUseCase;

import java.util.Arrays;

@Slf4j
@RestController
@RequiredArgsConstructor
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
    private final ClientIpResolver clientIpResolver;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse response) {
        rateLimiterService.checkLoginRate(clientIpResolver.resolve(httpRequest), request.email());
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
            // 원인 분석용: 쿠키 자체가 없는 경우(eviction·미저장) vs 죽은 토큰(아래 catch)
            log.info("auth.refresh.fail reason=no_cookie");
            return ResponseEntity.status(401).build();
        }
        rateLimiterService.checkRefreshRate(clientIpResolver.resolve(httpRequest));
        try {
            TokenPairResult result = refreshTokenUseCase.refresh(new RefreshTokenCommand(refreshToken));
            addRefreshCookie(response, result.refreshToken());
            return ResponseEntity.ok(new LoginResponse(result.accessToken(), result.memberId()));
        } catch (DomainException e) {
            // 쿠키는 있으나 토큰이 무효/만료/회전소멸 — 회전·쿠키 미저장 진단 지표
            log.info("auth.refresh.fail reason=dead_token");
            throw e;
        }
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
        rateLimiterService.checkLoginRate(clientIpResolver.resolve(httpRequest));
        GoogleLoginResult result = googleLoginUseCase.loginWithGoogle(
                new GoogleLoginCommand(request.code(), request.redirectUri()));
        addRefreshCookie(response, result.refreshToken());
        return ResponseEntity.ok(new GoogleAuthResponse(result.accessToken(), result.memberId(), result.newMember()));
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
