package project.TimeManager.domain.port.out.auth;

import java.util.Optional;

/**
 * Apple 서버와의 토큰 교환·철회. 계정 삭제 시 앱의 Sign in with Apple 승인을 철회하라는
 * App Store 가이드라인 5.1.1(v) 를 위해 존재한다.
 *
 * <p>.p8 키 등 설정이 없으면 {@link #isEnabled()} 가 false 이고 호출부는 아무것도 하지 않는다 —
 * 로그인은 identity token 만으로 완결되므로 이 포트가 꺼져 있어도 로그인은 그대로 동작한다.
 */
public interface AppleTokenPort {

    boolean isEnabled();

    /**
     * 앱이 받은 authorizationCode(1회용, 5분 유효)를 Apple refresh token 으로 바꾼다.
     *
     * @return Apple 이 거부했거나 응답하지 않으면 empty. 예외를 던지지 않는다.
     */
    Optional<String> exchangeAuthorizationCode(String authorizationCode);

    /** @return Apple 이 철회 요청을 받아들였으면 true. 예외를 던지지 않는다. */
    boolean revokeRefreshToken(String refreshToken);
}
