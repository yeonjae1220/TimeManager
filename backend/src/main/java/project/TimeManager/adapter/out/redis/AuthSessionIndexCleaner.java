package project.TimeManager.adapter.out.redis;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * TTL 로 만료된 세션이 남긴 Spring Data Redis 인덱스 찌꺼기를 지운다.
 *
 * Spring Data Redis 리포지토리는 해시({@code auth_session:<id>})에만 TTL 을 걸고,
 * 인덱스 — 키스페이스 집합 {@code auth_session}, {@code @Indexed} 집합
 * {@code auth_session:memberId:<v>}, 역참조 {@code auth_session:<id>:idx} — 에는
 * TTL 이 없다. 해시가 만료될 때 이 인덱스를 지우는 건 keyspace 이벤트 리스너뿐인데
 * 우리는 그걸 켜지 않았으므로(notify-keyspace-events 비어 있음), 회전·로그아웃 없이
 * 버려진 세션은 인덱스에 영원히 남는다. Redis 가 noeviction + AOF 라 재시작해도
 * 사라지지 않고, 쌓이면 결국 쓰기가 OOM 으로 거부된다.
 *
 * keyspace 이벤트 대신 주기 정리를 고른 이유: 이벤트는 pub/sub 이라 백엔드가 내려가
 * 있던 동안(배포·재시작) 만료된 키는 영영 놓치고, 세션마다 phantom 사본을 하나 더
 * 저장해야 하며, 이미 쌓인 찌꺼기는 지우지 못한다. 이 정리는 멱등이라 몇 번 놓쳐도
 * 다음 실행이 따라잡는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuthSessionIndexCleaner {

    /** {@link AuthSessionRedisEntity} 의 {@code @RedisHash} 값과 같아야 한다(테스트가 고정). */
    static final String KEYSPACE = "auth_session";

    private static final int SCAN_BATCH_SIZE = 500;

    /**
     * 해시가 없을 때만 그 id 를 모든 인덱스에서 뺀다. 확인과 삭제를 한 스크립트로 묶어
     * 그 사이에 같은 id 가 다시 저장되는 경우에도 살아 있는 세션의 인덱스를 지우지 않는다.
     *
     * {@code :idx} 집합에 적힌 인덱스 키는 KEYS 로 미리 알 수 없어 스크립트 안에서 접근한다.
     * 단일 노드 Redis 라 문제없지만 Redis Cluster 로 옮기면 다시 봐야 한다.
     *
     * KEYS[1]=세션 해시, KEYS[2]=:idx 집합, KEYS[3]=키스페이스 집합, ARGV[1]=id.
     * 반환: 정리했으면 1, 살아 있는 세션이면 0.
     */
    private static final RedisScript<Long> PRUNE_IF_EXPIRED = RedisScript.of("""
            if redis.call('EXISTS', KEYS[1]) == 1 then
              return 0
            end
            for _, indexKey in ipairs(redis.call('SMEMBERS', KEYS[2])) do
              redis.call('SREM', indexKey, ARGV[1])
            end
            redis.call('DEL', KEYS[2])
            redis.call('SREM', KEYS[3], ARGV[1])
            return 1
            """, Long.class);

    private final StringRedisTemplate redisTemplate;

    // 04:30 회원 purge 와 겹치지 않게 15분 뒤. 하루 수백 바이트씩 쌓이는 양이라 하루 한 번이면 충분하다.
    @Scheduled(cron = "0 45 4 * * *")
    public void scheduledPrune() {
        try {
            int pruned = pruneExpiredSessionIndexes();
            // 0건이어도 남긴다 — "지울 게 없었다"와 "안 돌았다"를 로그로 구분하기 위해.
            log.info("[Auth Session Index] 만료 세션 인덱스 {}건 정리", pruned);
        } catch (Exception e) {
            // 여기서 던지면 스케줄러 스레드가 멈춰 이후 실행이 사라진다. 멱등이라 다음 실행이 따라잡는다.
            log.error("[Auth Session Index] 정리 실패 — 다음 실행에서 재시도된다", e);
        }
    }

    /**
     * 키스페이스 집합을 SSCAN 하며 해시가 사라진 id 를 정리한다.
     * SSCAN 도중 SREM 해도 안전하다 — 스캔 내내 남아 있는 원소는 반드시 한 번 이상 돌려준다.
     *
     * @return 정리한 세션 수
     */
    public int pruneExpiredSessionIndexes() {
        int pruned = 0;
        ScanOptions options = ScanOptions.scanOptions().count(SCAN_BATCH_SIZE).build();
        try (Cursor<String> cursor = redisTemplate.opsForSet().scan(KEYSPACE, options)) {
            while (cursor.hasNext()) {
                if (pruneIfExpired(cursor.next())) {
                    pruned++;
                }
            }
        }
        return pruned;
    }

    private boolean pruneIfExpired(String id) {
        String sessionKey = KEYSPACE + ":" + id;
        List<String> keys = List.of(sessionKey, sessionKey + ":idx", KEYSPACE);
        Long result = redisTemplate.execute(PRUNE_IF_EXPIRED, keys, id);
        return Long.valueOf(1L).equals(result);
    }
}
