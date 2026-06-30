package project.TimeManager.adapter.out.redis;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import project.TimeManager.domain.auth.model.AuthSession;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.port.out.auth.TokenStorePort;
import project.TimeManager.shared.security.TokenHasher;

import java.util.Optional;

@Component
@RequiredArgsConstructor
public class RedisTokenStoreAdapter implements TokenStorePort {

    private final AuthSessionRedisRepository authSessionRedisRepository;

    @Override
    public void save(AuthSession session) {
        authSessionRedisRepository.save(toEntity(session));
    }

    @Override
    public Optional<AuthSession> findByRefreshToken(String refreshToken) {
        return authSessionRedisRepository.findById(TokenHasher.sha256(refreshToken))
                .map(entity -> toDomain(entity, refreshToken));
    }

    @Override
    public void delete(String refreshToken) {
        authSessionRedisRepository.deleteById(TokenHasher.sha256(refreshToken));
    }

    private AuthSessionRedisEntity toEntity(AuthSession session) {
        AuthSessionRedisEntity entity = new AuthSessionRedisEntity();
        entity.setTokenHash(TokenHasher.sha256(session.getRefreshToken()));
        entity.setMemberId(session.getMemberId().value());
        entity.setExpiresAt(session.getExpiresAt());
        entity.setLastRotatedAt(session.getLastRotatedAt());
        return entity;
    }

    private AuthSession toDomain(AuthSessionRedisEntity entity, String refreshToken) {
        // The plaintext token is never persisted; pass back the value the caller
        // supplied so the reconstituted session stays consistent for downstream use.
        return AuthSession.reconstitute(
                MemberId.of(entity.getMemberId()),
                refreshToken,
                entity.getExpiresAt(),
                entity.getLastRotatedAt()  // null(구 엔티티)이면 reconstitute가 EPOCH로 처리 → 즉시 회전
        );
    }
}
