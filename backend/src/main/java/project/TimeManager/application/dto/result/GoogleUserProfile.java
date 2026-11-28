package project.TimeManager.application.dto.result;

/**
 * Google userinfo 응답.
 * {@code emailVerified} 가 false 면 그 이메일의 소유가 확인되지 않은 것이다 — 이메일로 기존 회원을
 * 찾는 로그인 흐름에서 그대로 믿으면 남의 주소를 단 Google 계정으로 그 회원에 들어갈 수 있다.
 */
public record GoogleUserProfile(
        String email,
        String name,
        String picture,
        String googleId,
        boolean emailVerified
) {}
