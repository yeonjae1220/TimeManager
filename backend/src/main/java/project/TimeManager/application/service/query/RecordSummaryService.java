package project.TimeManager.application.service.query;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.adapter.out.persistence.entity.RecordJpaEntity;
import project.TimeManager.application.dto.result.RecordSummaryResult;
import project.TimeManager.application.dto.result.RecordSummaryResult.SessionDetail;
import project.TimeManager.application.dto.result.RecordSummaryResult.TagSummary;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.port.in.record.GetRecordSummaryQuery;
import project.TimeManager.domain.port.out.member.LoadMemberPort;
import project.TimeManager.domain.port.out.record.LoadRecordsByMemberPort;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class RecordSummaryService implements GetRecordSummaryQuery {

    // Logs 화면(주/월 뷰)이 요일·주 단위로 summary를 5~7회 병렬 호출하므로,
    // 매 호출마다 Member를 다시 조회하는 중복을 피하기 위한 짧은 TTL 캐시.
    // timezone/dailyResetHour 두 값만 보관 — 비밀번호 해시·role 등 민감 필드는 다루지 않으므로
    // 별도 무효화(evict) 없이 TTL만으로 신선도를 확보해도 안전하다.
    private static final long DAY_BOUNDARY_CACHE_TTL_MILLIS = 60_000L;
    private final Map<Long, DayBoundaryCacheEntry> dayBoundaryCache = new ConcurrentHashMap<>();

    private record DayBoundarySettings(ZoneId zone, int resetHour) {}
    private record DayBoundaryCacheEntry(DayBoundarySettings settings, long expiresAtMillis) {}

    private final LoadRecordsByMemberPort loadRecordsByMemberPort;
    private final LoadMemberPort loadMemberPort;

    @Override
    public RecordSummaryResult getSummary(Long memberId, LocalDate startDate, LocalDate endDate) {
        DayBoundarySettings settings = loadDayBoundarySettings(memberId);
        ZoneId userZone = settings.zone();
        int resetHour = settings.resetHour();

        // "하루"의 경계는 회원의 dailyResetHour를 기준으로 한다 (TagRecordDerivedFieldsSyncService.isToday와 동일 규칙).
        ZonedDateTime start = startDate.atStartOfDay(userZone).plusHours(resetHour);
        ZonedDateTime end = endDate.plusDays(1).atStartOfDay(userZone).plusHours(resetHour);

        List<RecordJpaEntity> records = loadRecordsByMemberPort.loadRecordsByMemberAndDateRange(memberId, start, end);

        Map<Long, List<RecordJpaEntity>> byTag = records.stream()
                .collect(Collectors.groupingBy(r -> r.getTag().getId(), LinkedHashMap::new, Collectors.toList()));

        long grandTotal = 0L;
        List<TagSummary> tagSummaries = new ArrayList<>();

        for (Map.Entry<Long, List<RecordJpaEntity>> entry : byTag.entrySet()) {
            List<RecordJpaEntity> tagRecords = entry.getValue();
            RecordJpaEntity sample = tagRecords.get(0);
            String tagName = sample.getTag().getName();
            String parentTagName = sample.getTag().getParent() != null
                    ? sample.getTag().getParent().getName()
                    : null;

            long tagTotal = tagRecords.stream().mapToLong(RecordJpaEntity::getTotalTime).sum();
            grandTotal += tagTotal;

            List<SessionDetail> sessions = tagRecords.stream()
                    .map(r -> new SessionDetail(r.getStartTime(), r.getEndTime(), r.getTotalTime()))
                    .collect(Collectors.toList());

            tagSummaries.add(new TagSummary(entry.getKey(), tagName, parentTagName, tagTotal, tagRecords.size(), sessions));
        }

        tagSummaries.sort(Comparator.comparingLong(TagSummary::getTotalSeconds).reversed());

        return new RecordSummaryResult(grandTotal, tagSummaries);
    }

    private DayBoundarySettings loadDayBoundarySettings(Long memberId) {
        long now = System.currentTimeMillis();
        DayBoundaryCacheEntry cached = dayBoundaryCache.get(memberId);
        if (cached != null && cached.expiresAtMillis() > now) {
            return cached.settings();
        }

        Member member = loadMemberPort.loadMember(memberId)
                .orElseThrow(() -> new DomainException("Member not found: " + memberId));
        DayBoundarySettings settings = new DayBoundarySettings(
                ZoneId.of(member.getTimezone()), member.getDailyResetHour());
        dayBoundaryCache.put(memberId, new DayBoundaryCacheEntry(settings, now + DAY_BOUNDARY_CACHE_TTL_MILLIS));
        return settings;
    }
}
