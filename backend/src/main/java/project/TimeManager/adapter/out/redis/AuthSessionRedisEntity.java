package project.TimeManager.adapter.out.redis;

import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.redis.core.index.Indexed;
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

    /**
     * 회원 탈퇴 시 그 회원의 세션을 한꺼번에 끊기 위해 인덱싱한다.
     *
     * ⚠️ 보조 인덱스는 **쓰기 시점에** 만들어지므로, 이 애노테이션을 붙이기 전에
     * 저장된 세션은 memberId 로 찾을 수 없다. 회전(rotate)·재로그인으로 자연히
     * 채워지지만 그 전까지는 누락될 수 있다. 그래서 탈퇴의 실제 관문은 이 revoke 가
     * 아니라 refresh 가 삭제된 회원을 거부하는 것이고, 이쪽은 정리 목적이다.
     */
    @Indexed
    private Long memberId;

    private Instant expiresAt;

    private Instant lastRotatedAt;

    @TimeToLive(unit = TimeUnit.SECONDS)
    private long ttl = 30 * 24 * 60 * 60L; // 30 days
}
