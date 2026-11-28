package project.TimeManager.domain.port.out.auth;

import java.time.Instant;

/**
 * 외부 제공자가 서명한 identity token 을 한 번만 받아들이게 한다.
 * 서명·만료·nonce 검증을 통과한 토큰이라도, 가로챈 요청 본문(토큰 + nonce 원문)을 그대로 다시 보내면
 * 만료 전까지 몇 번이고 세션을 새로 받을 수 있다 — 그 재전송을 막는다.
 */
public interface IdentityTokenReplayGuardPort {

    /**
     * 이 토큰을 처음 보는 것이면 사용됨으로 기록하고 true, 이미 쓰인 토큰이면 false.
     *
     * @param identityToken 검증을 마친 토큰 원문 — 구현은 해시만 저장하고 원문(신원 정보)은 남기지 않는다
     * @param expiresAt 토큰 만료 시각 — 그 뒤로는 서명 검증에서 걸러지므로 기록을 오래 둘 필요가 없다
     */
    boolean markUsedOnce(String identityToken, Instant expiresAt);
}
