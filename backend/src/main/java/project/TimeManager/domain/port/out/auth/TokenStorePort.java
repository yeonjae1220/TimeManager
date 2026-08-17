package project.TimeManager.domain.port.out.auth;

import project.TimeManager.domain.auth.model.AuthSession;

import java.util.Optional;

public interface TokenStorePort {
    void save(AuthSession session);
    Optional<AuthSession> findByRefreshToken(String refreshToken);
    void delete(String refreshToken);

    /**
     * 이 회원의 모든 리프레시 세션을 끊는다. 탈퇴 시 남은 세션이 계속 액세스 토큰을
     * 찍어내지 못하게 하기 위한 정리 — 유일한 방어선은 아니다(구현 주석 참조).
     *
     * @return 지워진 세션 수
     */
    int deleteByMemberId(Long memberId);
}
