package project.TimeManager.shared.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;
import project.TimeManager.domain.exception.TooManyRequestsException;

import java.util.List;

@Component
public class RateLimiterService {

    private static final RedisScript<Long> INCREMENT_SCRIPT = RedisScript.of(
            "local c = redis.call('INCR', KEYS[1])\n" +
            "if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end\n" +
            "return c",
            Long.class);

    private final RedisTemplate<String, String> redisTemplate;
    private final int loginLimit;
    private final int refreshLimit;
    private final int windowSeconds;

    public RateLimiterService(
            RedisTemplate<String, String> redisTemplate,
            @Value("${app.rate-limit.login-limit:10}") int loginLimit,
            @Value("${app.rate-limit.refresh-limit:30}") int refreshLimit,
            @Value("${app.rate-limit.window-seconds:600}") int windowSeconds
    ) {
        this.redisTemplate = redisTemplate;
        this.loginLimit = loginLimit;
        this.refreshLimit = refreshLimit;
        this.windowSeconds = windowSeconds;
    }

    public void checkLoginRate(String clientIp) {
        check("rl:login:ip:" + clientIp, loginLimit);
    }

    public void checkRefreshRate(String clientIp) {
        check("rl:refresh:" + clientIp, refreshLimit);
    }

    private void check(String key, int limit) {
        Long count = redisTemplate.execute(INCREMENT_SCRIPT, List.of(key), String.valueOf(windowSeconds));
        if (count != null && count > limit) {
            throw new TooManyRequestsException("요청이 너무 많습니다. 잠시 후 다시 시도해주세요");
        }
    }
}
