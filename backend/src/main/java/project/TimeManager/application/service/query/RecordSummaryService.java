package project.TimeManager.application.service.query;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.adapter.out.persistence.entity.RecordJpaEntity;
import project.TimeManager.application.dto.result.RecordSummaryResult;
import project.TimeManager.application.dto.result.RecordSummaryResult.SessionDetail;
import project.TimeManager.application.dto.result.RecordSummaryResult.TagSummary;
import project.TimeManager.application.service.MemberDayBoundarySettingsCache;
import project.TimeManager.application.service.MemberDayBoundarySettingsCache.Settings;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.port.in.record.GetRecordSummaryQuery;
import project.TimeManager.domain.port.out.member.LoadMemberPort;
import project.TimeManager.domain.port.out.record.LoadRecordsByMemberPort;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class RecordSummaryService implements GetRecordSummaryQuery {

    private final LoadRecordsByMemberPort loadRecordsByMemberPort;
    private final LoadMemberPort loadMemberPort;
    private final MemberDayBoundarySettingsCache dayBoundaryCache;

    @Override
    public RecordSummaryResult getSummary(Long memberId, LocalDate startDate, LocalDate endDate) {
        Settings settings = loadDayBoundarySettings(memberId);
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

    private Settings loadDayBoundarySettings(Long memberId) {
        return dayBoundaryCache.get(memberId).orElseGet(() -> {
            Member member = loadMemberPort.loadMember(memberId)
                    .orElseThrow(() -> new DomainException("Member not found: " + memberId));
            Settings settings = new Settings(ZoneId.of(member.getTimezone()), member.getDailyResetHour());
            dayBoundaryCache.put(memberId, settings);
            return settings;
        });
    }
}
