package project.TimeManager.adapter.out.redis;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisKeyValueAdapter;
import org.springframework.data.redis.core.RedisKeyValueTemplate;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.mapping.RedisMappingContext;
import org.springframework.data.redis.repository.support.RedisRepositoryFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 실제 Redis 위에서 Spring Data Redis 리포지토리가 남기는 키 배치를 그대로 재현해,
 * TTL 만료 후 인덱스가 새는 것과 정리 스크립트가 그것만 지우는 것을 확인한다.
 * 리포지토리는 운영과 같은 기본값(keyspace 이벤트 OFF)으로 만든다.
 */
@Testcontainers(disabledWithoutDocker = true)
class AuthSessionIndexCleanerIntegrationTest {

    private static final long MEMBER_ID = 102L;
    private static final String MEMBER_INDEX = "auth_session:memberId:" + MEMBER_ID;

    @Container
    private static final GenericContainer<?> REDIS =
            new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

    private LettuceConnectionFactory connectionFactory;
    private StringRedisTemplate redis;
    private AuthSessionRedisRepository repository;
    private AuthSessionIndexCleaner cleaner;

    @BeforeEach
    void setUp() throws Exception {
        connectionFactory = new LettuceConnectionFactory(
                new RedisStandaloneConfiguration(REDIS.getHost(), REDIS.getMappedPort(6379)));
        connectionFactory.afterPropertiesSet();
        connectionFactory.start();

        redis = new StringRedisTemplate(connectionFactory);
        redis.getRequiredConnectionFactory().getConnection().serverCommands().flushAll();

        RedisTemplate<byte[], byte[]> bytesTemplate = new RedisTemplate<>();
        bytesTemplate.setConnectionFactory(connectionFactory);
        bytesTemplate.afterPropertiesSet();
        RedisMappingContext mappingContext = new RedisMappingContext();
        RedisKeyValueAdapter adapter = new RedisKeyValueAdapter(bytesTemplate, mappingContext);
        adapter.afterPropertiesSet();
        repository = new RedisRepositoryFactory(new RedisKeyValueTemplate(adapter, mappingContext))
                .getRepository(AuthSessionRedisRepository.class);

        cleaner = new AuthSessionIndexCleaner(redis);
    }

    @AfterEach
    void tearDown() {
        connectionFactory.destroy();
    }

    @Test
    @DisplayName("TTL 로 만료된 세션의 키스페이스·memberId·:idx 인덱스를 지우고 살아 있는 세션은 그대로 둔다")
    void prunesOnlyExpiredSessionIndexes() throws InterruptedException {
        save("expired", 1);
        save("live", 3600);
        awaitExpiry("auth_session:expired");

        // 정리 전: 해시는 사라졌는데 인덱스는 남아 있다(이 클래스가 존재하는 이유)
        assertThat(redis.opsForSet().members("auth_session")).contains("expired");
        assertThat(redis.opsForSet().members(MEMBER_INDEX)).contains("expired");
        assertThat(redis.hasKey("auth_session:expired:idx")).isTrue();

        int pruned = cleaner.pruneExpiredSessionIndexes();

        assertThat(pruned).isEqualTo(1);
        assertThat(redis.opsForSet().members("auth_session")).containsExactly("live");
        assertThat(redis.opsForSet().members(MEMBER_INDEX)).containsExactly("live");
        assertThat(redis.hasKey("auth_session:expired:idx")).isFalse();
        assertThat(redis.hasKey("auth_session:live")).isTrue();
        assertThat(redis.hasKey("auth_session:live:idx")).isTrue();
        assertThat(repository.findByMemberId(MEMBER_ID))
                .extracting(AuthSessionRedisEntity::getTokenHash)
                .containsExactly("live");
    }

    @Test
    @DisplayName("@Indexed 이전에 저장돼 :idx 가 없는 세션도 키스페이스 집합에서 빠진다")
    void prunesLegacySessionWithoutIndexSet() {
        // 운영 2026-10-01 실측과 같은 모양: 키스페이스 집합에만 남은 id
        redis.opsForSet().add("auth_session", "legacy");

        int pruned = cleaner.pruneExpiredSessionIndexes();

        assertThat(pruned).isEqualTo(1);
        assertThat(redis.hasKey("auth_session")).isFalse();
    }

    @Test
    @DisplayName("두 번 돌려도 결과가 같다 — 멱등")
    void isIdempotent() throws InterruptedException {
        save("expired", 1);
        awaitExpiry("auth_session:expired");

        assertThat(cleaner.pruneExpiredSessionIndexes()).isEqualTo(1);
        assertThat(cleaner.pruneExpiredSessionIndexes()).isZero();
    }

    private void save(String tokenHash, long ttlSeconds) {
        AuthSessionRedisEntity entity = new AuthSessionRedisEntity();
        entity.setTokenHash(tokenHash);
        entity.setMemberId(MEMBER_ID);
        entity.setExpiresAt(Instant.now().plusSeconds(ttlSeconds));
        entity.setLastRotatedAt(Instant.now());
        entity.setTtl(ttlSeconds);
        repository.save(entity);
    }

    private void awaitExpiry(String key) throws InterruptedException {
        Instant deadline = Instant.now().plus(Duration.ofSeconds(10));
        while (Boolean.TRUE.equals(redis.hasKey(key))) {
            assertThat(Instant.now()).as("%s 가 TTL 로 만료되지 않았다", key).isBefore(deadline);
            Thread.sleep(100);
        }
    }
}
