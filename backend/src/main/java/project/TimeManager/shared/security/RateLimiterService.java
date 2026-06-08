package project.TimeManager.shared.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;
import project.TimeManager.domain.exception.TooManyRequestsException;

import java.util.List;
import java.util.Locale;

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
    private final int registerLimit;
    private final int windowSeconds;

    public RateLimiterService(
            RedisTemplate<String, String> redisTemplate,
            @Value("${app.rate-limit.login-limit:10}") int loginLimit,
            @Value("${app.rate-limit.refresh-limit:30}") int refreshLimit,
            @Value("${app.rate-limit.register-limit:5}") int registerLimit,
            @Value("${app.rate-limit.window-seconds:600}") int windowSeconds
    ) {
        this.redisTemplate = redisTemplate;
        this.loginLimit = loginLimit;
        this.refreshLimit = refreshLimit;
        this.registerLimit = registerLimit;
        this.windowSeconds = windowSeconds;
    }

    public void checkLoginRate(String clientIp) {
        check("rl:login:ip:" + clientIp, loginLimit);
    }

    /**
     * IP와 정규화된 이메일 두 차원에서 함께 제한해, 공격자가 IP를 바꿔가며
     * 특정 계정에 무차별 대입하거나 한 IP로 여러 계정을 스터핑하는 것을 모두 방어한다.
     */
    public void checkLoginRate(String clientIp, String email) {
        check("rl:login:ip:" + clientIp, loginLimit);
        check("rl:login:email:" + normalizeEmail(email), loginLimit);
    }

    public void checkRefreshRate(String clientIp) {
        check("rl:refresh:" + clientIp, refreshLimit);
    }

    public void checkRegisterRate(String clientIp, String email) {
        check("rl:register:ip:" + clientIp, registerLimit);
        check("rl:register:email:" + normalizeEmail(email), registerLimit);
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private void check(String key, int limit) {
        Long count = redisTemplate.execute(INCREMENT_SCRIPT, List.of(key), String.valueOf(windowSeconds));
        if (count != null && count > limit) {
            throw new TooManyRequestsException("요청이 너무 많습니다. 잠시 후 다시 시도해주세요");
        }
    }
}
