package project.TimeManager.adapter.out.redis;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import project.TimeManager.shared.security.TokenHasher;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

@ExtendWith(MockitoExtension.class)
@DisplayName("RedisIdentityTokenReplayGuardAdapter")
class RedisIdentityTokenReplayGuardAdapterTest {

    private static final Instant NOW = Instant.parse("2026-11-28T12:00:00Z");

    @Mock RedisTemplate<String, String> redisTemplate;
    @Mock ValueOperations<String, String> valueOps;

    RedisIdentityTokenReplayGuardAdapter adapter;

    @BeforeEach
    void setUp() {
        given(redisTemplate.opsForValue()).willReturn(valueOps);
        adapter = new RedisIdentityTokenReplayGuardAdapter(redisTemplate, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    @DisplayName("처음 보는 토큰은 해시 키로 만료+여유 시간만큼 기록하고 통과시킨다 — 원문은 키에 넣지 않는다")
    void firstUsePasses() {
        Instant exp = NOW.plusSeconds(600);
        String key = RedisIdentityTokenReplayGuardAdapter.KEY_PREFIX + TokenHasher.sha256("tok");
        Duration ttl = Duration.ofSeconds(600).plus(RedisIdentityTokenReplayGuardAdapter.EXPIRY_MARGIN);
        given(valueOps.setIfAbsent(key, "1", ttl)).willReturn(true);

        assertThat(adapter.markUsedOnce("tok", exp)).isTrue();
        then(valueOps).should().setIfAbsent(eq(key), eq("1"), eq(ttl));
    }

    @Test
    @DisplayName("이미 기록된 토큰은 거부한다")
    void secondUseRejected() {
        given(valueOps.setIfAbsent(anyString(), anyString(), any(Duration.class))).willReturn(false);

        assertThat(adapter.markUsedOnce("tok", NOW.plusSeconds(600))).isFalse();
    }

    @Test
    @DisplayName("시계 오차 허용 안에서 막 만료된 토큰도 여유 시간만큼은 기록한다 — TTL 0 으로 기록이 바로 사라지지 않게")
    void justExpiredTokenStillRecorded() {
        given(valueOps.setIfAbsent(anyString(), anyString(), any(Duration.class))).willReturn(true);

        adapter.markUsedOnce("tok", NOW.minusSeconds(20));

        then(valueOps).should().setIfAbsent(anyString(), eq("1"),
                eq(RedisIdentityTokenReplayGuardAdapter.EXPIRY_MARGIN.minusSeconds(20)));
    }
}
