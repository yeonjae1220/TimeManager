package project.TimeManager.domain.port.out.auth;

import project.TimeManager.application.dto.result.AppleIdentity;

public interface AppleIdentityTokenPort {
    /**
     * Apple 이 발급한 identity token(JWT)을 검증하고 신원을 꺼낸다.
     *
     * @param rawNonce 클라이언트가 만든 원문 nonce. 토큰의 nonce 클레임은 이 값의 SHA-256 이어야 한다.
     * @throws project.TimeManager.domain.exception.DomainException 서명·발급자·대상·만료·nonce 중 하나라도 어긋나면
     */
    AppleIdentity verify(String identityToken, String rawNonce);
}
