package project.TimeManager.application.service;

import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * memberId → {timezone, dailyResetHour} 짧은 TTL 캐시.
 *
 * RecordSummaryService(조회)와 UpdateMemberProfileCommandService(수정) 양쪽에서 공유한다.
 * 프로필 저장 성공 시 evict()로 즉시 무효화하는 것이 기본 경로이고, TTL은 향후 새 쓰기
 * 경로가 evict 호출을 빠뜨렸을 때를 대비한 안전망이다. 비밀번호 해시·role 등 민감 필드는
 * 다루지 않으므로 짧은 staleness에 보안 리스크가 없다.
 *
 * 주의: 캐시는 JVM 인스턴스 로컬이다 — 백엔드가 단일 레플리카(k8s/backend.yaml replicas: 1)인
 * 동안은 evict가 완전히 결정론적이지만, 향후 레플리카를 늘리면 evict를 받지 못한 다른 파드는
 * 자신의 TTL이 끝날 때까지 stale한 값을 반환할 수 있다.
 */
@Component
public class MemberDayBoundarySettingsCache {

    private static final long TTL_MILLIS = 60_000L;

    public record Settings(ZoneId zone, int resetHour) {}

    private record Entry(Settings settings, long expiresAtMillis) {}

    private final Map<Long, Entry> cache = new ConcurrentHashMap<>();

    public Optional<Settings> get(Long memberId) {
        Entry entry = cache.get(memberId);
        if (entry != null && entry.expiresAtMillis() > System.currentTimeMillis()) {
            return Optional.of(entry.settings());
        }
        return Optional.empty();
    }

    public void put(Long memberId, Settings settings) {
        cache.put(memberId, new Entry(settings, System.currentTimeMillis() + TTL_MILLIS));
    }

    public void evict(Long memberId) {
        cache.remove(memberId);
    }
}
