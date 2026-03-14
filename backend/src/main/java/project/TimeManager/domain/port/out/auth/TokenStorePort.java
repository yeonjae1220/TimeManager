package project.TimeManager.domain.port.out.auth;

import project.TimeManager.domain.auth.model.AuthSession;

import java.util.Optional;

public interface TokenStorePort {
    void save(AuthSession session);
    Optional<AuthSession> findByRefreshToken(String refreshToken);
    void delete(String refreshToken);
}
