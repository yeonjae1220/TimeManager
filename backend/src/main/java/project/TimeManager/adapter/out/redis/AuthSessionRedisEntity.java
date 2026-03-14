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

    @Id
    private String refreshToken;

    private Long memberId;

    private Instant expiresAt;

    @TimeToLive(unit = TimeUnit.SECONDS)
    private long ttl = 7 * 24 * 60 * 60L; // 7 days
}
