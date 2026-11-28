package project.TimeManager.domain.port.out.auth;

import java.util.Optional;

/**
 * 회원별 Apple refresh token 보관. 구현은 저장 전에 암호화한다 — 이 값은 우리 서버가 Apple 에
 * 대해 그 사용자로 행동할 수 있는 자격증명이다. 용도는 계정 삭제 때 철회하는 것 하나뿐이다.
 */
public interface AppleRefreshTokenStorePort {

    /** 삭제되지 않은 회원에게만 저장한다(최신 값으로 덮어쓴다). */
    void save(Long memberId, String refreshToken);

    /** 소프트 삭제된 회원도 찾는다 — 삭제 직후와 purge 때 철회해야 하므로. */
    Optional<String> find(Long memberId);

    /**
     * 지금 철회해도 되는 토큰. {@link #find} 와 같되, 같은 Apple ID 로 다시 가입한 활성 회원이 있으면 empty —
     * Apple 승인은 사용자·앱 단위라 옛 토큰 철회가 새 계정의 승인까지 끊는다.
     */
    Optional<String> findRevocable(Long memberId);

    void clear(Long memberId);
}
