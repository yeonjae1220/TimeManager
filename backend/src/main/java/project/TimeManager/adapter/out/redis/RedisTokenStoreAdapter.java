package project.TimeManager.adapter.out.redis;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import project.TimeManager.domain.auth.model.AuthSession;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.port.out.auth.TokenStorePort;

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
        return authSessionRedisRepository.findById(refreshToken)
                .map(this::toDomain);
    }

    @Override
    public void delete(String refreshToken) {
        authSessionRedisRepository.deleteById(refreshToken);
    }

    private AuthSessionRedisEntity toEntity(AuthSession session) {
        AuthSessionRedisEntity entity = new AuthSessionRedisEntity();
        entity.setRefreshToken(session.getRefreshToken());
        entity.setMemberId(session.getMemberId().value());
        entity.setExpiresAt(session.getExpiresAt());
        return entity;
    }

    private AuthSession toDomain(AuthSessionRedisEntity entity) {
        return AuthSession.reconstitute(
                MemberId.of(entity.getMemberId()),
                entity.getRefreshToken(),
                entity.getExpiresAt()
        );
    }
}
