package project.TimeManager.adapter.out.redis;

import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.redis.core.RedisHash;
import org.springframework.data.redis.core.TimeToLive;

import java.time.Instant;
import java.util.concurrent.TimeUnit;

@RedisHash("auth_session")
@Getter
@Setter
public class AuthSessionRedisEntity {

    /**
     * SHA-256 hash of the refresh token (hex). Never the plaintext token —
     * storing the raw token would expose it as the Redis key. See GLOBAL-PIT-001.
     */
    @Id
    private String tokenHash;

    private Long memberId;

    private Instant expiresAt;

    @TimeToLive(unit = TimeUnit.SECONDS)
    private long ttl = 30 * 24 * 60 * 60L; // 30 days
}
