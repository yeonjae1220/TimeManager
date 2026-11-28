package project.TimeManager.adapter.out.redis;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import project.TimeManager.domain.port.out.auth.IdentityTokenReplayGuardPort;
import project.TimeManager.shared.security.TokenHasher;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

@Component
public class RedisIdentityTokenReplayGuardAdapter implements IdentityTokenReplayGuardPort {

    static final String KEY_PREFIX = "auth:idtoken:used:";

    /**
     * 토큰 검증은 만료 시각에 시계 오차(30초)를 더해 허용한다. 기록이 그보다 먼저 사라지면
     * 그 틈에 같은 토큰이 다시 통과하므로, 오차보다 넉넉히 더 둔다.
     */
    static final Duration EXPIRY_MARGIN = Duration.ofMinutes(2);

    private final RedisTemplate<String, String> redisTemplate;
    private final Clock clock;

    @Autowired
    public RedisIdentityTokenReplayGuardAdapter(RedisTemplate<String, String> redisTemplate) {
        this(redisTemplate, Clock.systemUTC());
    }

    RedisIdentityTokenReplayGuardAdapter(RedisTemplate<String, String> redisTemplate, Clock clock) {
        this.redisTemplate = redisTemplate;
        this.clock = clock;
    }

    @Override
    public boolean markUsedOnce(String identityToken, Instant expiresAt) {
        Duration ttl = Duration.between(clock.instant(), expiresAt).plus(EXPIRY_MARGIN);
        if (ttl.isNegative() || ttl.isZero()) {
            ttl = EXPIRY_MARGIN;
        }
        // SET NX EX — 확인과 기록이 한 번의 원자적 명령이라 동시에 두 번 보내도 하나만 통과한다.
        Boolean firstUse = redisTemplate.opsForValue().setIfAbsent(KEY_PREFIX + TokenHasher.sha256(identityToken), "1", ttl);
        return Boolean.TRUE.equals(firstUse);
    }
}
