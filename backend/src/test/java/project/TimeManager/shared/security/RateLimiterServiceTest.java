package project.TimeManager.shared.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import project.TimeManager.domain.exception.TooManyRequestsException;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("RateLimiterService")
class RateLimiterServiceTest {

    @Mock private RedisTemplate<String, String> redisTemplate;

    @Test
    @DisplayName("checkLoginRate(ip, email): IP와 정규화된 이메일 차원의 키를 모두 증가시킨다")
    void checkLoginRateWithEmail_hitsIpAndNormalizedEmailKeys() {
        RateLimiterService limiter = limiter();
        when(redisTemplate.execute(any(RedisScript.class), any(), any())).thenReturn(1L);

        limiter.checkLoginRate("203.0.113.7", " Alice@Example.com ");

        verify(redisTemplate).execute(any(RedisScript.class), eq(java.util.List.of("rl:login:ip:203.0.113.7")), eq("600"));
        verify(redisTemplate).execute(any(RedisScript.class), eq(java.util.List.of("rl:login:email:alice@example.com")), eq("600"));
    }

    @Test
    @DisplayName("checkLoginRate(ip, email): 이메일 차원 한도를 넘으면 TooManyRequestsException")
    void checkLoginRateWithEmail_emailLimitExceededThrows() {
        RateLimiterService limiter = limiter();
        when(redisTemplate.execute(any(RedisScript.class), eq(java.util.List.of("rl:login:ip:203.0.113.7")), any())).thenReturn(1L);
        when(redisTemplate.execute(any(RedisScript.class), eq(java.util.List.of("rl:login:email:alice@example.com")), any())).thenReturn(11L);

        assertThatThrownBy(() -> limiter.checkLoginRate("203.0.113.7", "alice@example.com"))
                .isInstanceOf(TooManyRequestsException.class);
    }

    @Test
    @DisplayName("checkRegisterRate: IP와 정규화된 이메일 차원을 함께 제한한다")
    void checkRegisterRate_hitsIpAndNormalizedEmailKeys() {
        RateLimiterService limiter = limiter();
        when(redisTemplate.execute(any(RedisScript.class), any(), any())).thenReturn(1L);

        limiter.checkRegisterRate("203.0.113.7", " Alice@Example.com ");

        verify(redisTemplate).execute(any(RedisScript.class), eq(java.util.List.of("rl:register:ip:203.0.113.7")), eq("600"));
        verify(redisTemplate).execute(any(RedisScript.class), eq(java.util.List.of("rl:register:email:alice@example.com")), eq("600"));
    }

    @Test
    @DisplayName("checkRegisterRate: 한도를 넘으면 TooManyRequestsException")
    void checkRegisterRate_limitExceededThrows() {
        RateLimiterService limiter = limiter();
        when(redisTemplate.execute(any(RedisScript.class), eq(java.util.List.of("rl:register:ip:203.0.113.7")), any())).thenReturn(6L);

        assertThatThrownBy(() -> limiter.checkRegisterRate("203.0.113.7", "alice@example.com"))
                .isInstanceOf(TooManyRequestsException.class);
    }

    private RateLimiterService limiter() {
        return new RateLimiterService(redisTemplate, 10, 30, 5, 600);
    }
}
