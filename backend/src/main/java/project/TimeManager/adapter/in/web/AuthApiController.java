package project.TimeManager.adapter.in.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
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

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
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
