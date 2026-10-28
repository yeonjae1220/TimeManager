package project.TimeManager.adapter.out.redis;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.stubbing.OngoingStubbing;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisHash;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthSessionIndexCleanerTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private SetOperations<String, String> setOperations;
    @Mock private Cursor<String> cursor;

    @InjectMocks private AuthSessionIndexCleaner cleaner;

    @Test
    @DisplayName("키스페이스 이름은 엔티티의 @RedisHash 값과 같다 — 엔티티 이름을 바꾸면 정리가 엉뚱한 집합을 본다")
    void keyspace_matchesEntityRedisHash() {
        RedisHash redisHash = AuthSessionRedisEntity.class.getAnnotation(RedisHash.class);

        assertThat(redisHash.value()).isEqualTo(AuthSessionIndexCleaner.KEYSPACE);
    }

    @Test
    @DisplayName("스크립트가 1을 돌려준(해시가 사라진) id 만 정리 건수로 센다")
    void prune_countsOnlyExpiredIds() {
        givenKeyspaceMembers("expired-id", "live-id");
        whenScriptFor("expired-id").thenReturn(1L);
        whenScriptFor("live-id").thenReturn(0L);

        int pruned = cleaner.pruneExpiredSessionIndexes();

        assertThat(pruned).isEqualTo(1);
        verify(cursor).close();
    }

    @Test
    @DisplayName("id 마다 세션 해시·:idx·키스페이스 키를 스크립트에 넘긴다")
    void prune_passesSpringDataKeyLayoutToScript() {
        givenKeyspaceMembers("abc");
        whenScriptFor("abc").thenReturn(1L);

        cleaner.pruneExpiredSessionIndexes();

        verify(redisTemplate).execute(
                ArgumentMatchers.<RedisScript<Long>>any(),
                eq(List.of("auth_session:abc", "auth_session:abc:idx", "auth_session")),
                eq("abc"));
    }

    @Test
    @DisplayName("Redis 오류가 나도 스케줄 메서드는 예외를 밖으로 던지지 않는다")
    void scheduledPrune_swallowsRedisFailure() {
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.scan(eq("auth_session"), any(ScanOptions.class)))
                .thenThrow(new IllegalStateException("redis down"));

        assertThatCode(cleaner::scheduledPrune).doesNotThrowAnyException();
    }

    private void givenKeyspaceMembers(String... ids) {
        when(redisTemplate.opsForSet()).thenReturn(setOperations);
        when(setOperations.scan(eq("auth_session"), any(ScanOptions.class))).thenReturn(cursor);
        Boolean[] rest = new Boolean[ids.length];
        for (int i = 0; i < ids.length; i++) {
            rest[i] = i < ids.length - 1;
        }
        when(cursor.hasNext()).thenReturn(ids.length > 0, rest);
        if (ids.length > 0) {
            String[] tail = Arrays.copyOfRange(ids, 1, ids.length);
            when(cursor.next()).thenReturn(ids[0], tail);
        }
    }

    private OngoingStubbing<Long> whenScriptFor(String id) {
        return when(redisTemplate.execute(ArgumentMatchers.<RedisScript<Long>>any(), anyList(), eq(id)));
    }
}
