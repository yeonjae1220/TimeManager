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
import project.TimeManager.domain.member.model.MemberDayBoundary;
import project.TimeManager.domain.port.in.record.GetRecordSummaryQuery;
import project.TimeManager.domain.port.out.member.LoadMemberPort;
import project.TimeManager.domain.port.out.record.LoadRecordsByMemberPort;
import project.TimeManager.domain.tag.model.TagType;

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
    public RecordSummaryResult getSummary(Long memberId, LocalDate startDate, LocalDate endDate, boolean includeSessions) {
        if (endDate.isBefore(startDate) || java.time.temporal.ChronoUnit.DAYS.between(startDate, endDate) >= 366
                || startDate.getYear() < 1 || endDate.getYear() > 9999) {
            throw new DomainException("조회 기간은 시작일에서 최대 366일까지입니다");
        }
        Settings settings = loadDayBoundarySettings(memberId);
        ZoneId userZone = settings.zone();
        int resetHour = settings.resetHour();

        // "하루"의 경계는 회원의 dailyResetHour를 기준으로 한다 (TagRecordDerivedFieldsSyncService.isToday와 동일 규칙).
        ZonedDateTime start = MemberDayBoundary.startOf(startDate, userZone, resetHour);
        ZonedDateTime end = MemberDayBoundary.startOf(endDate.plusDays(1), userZone, resetHour);

        List<RecordJpaEntity> records = loadRecordsByMemberPort.loadRecordsByMemberAndDateRange(memberId, start, end);

        Map<Long, List<RecordJpaEntity>> byTag = records.stream()
                .collect(Collectors.groupingBy(r -> r.getTag().getId(), LinkedHashMap::new, Collectors.toList()));

        Map<LocalDate, Long> dailyTotals = new LinkedHashMap<>();
        for (LocalDate day = startDate; !day.isAfter(endDate); day = day.plusDays(1)) {
            dailyTotals.put(day, 0L);
        }
        for (RecordJpaEntity record : records) {
            LocalDate day = MemberDayBoundary.dateOf(record.getStartTime(), userZone, resetHour);
            dailyTotals.computeIfPresent(day, (key, total) -> total + record.getTotalTime());
        }

        long grandTotal = 0L;
        List<TagSummary> tagSummaries = new ArrayList<>();

        for (Map.Entry<Long, List<RecordJpaEntity>> entry : byTag.entrySet()) {
            List<RecordJpaEntity> tagRecords = entry.getValue();
            RecordJpaEntity sample = tagRecords.get(0);
            String tagName = sample.getTag().getName();
            var parent = sample.getTag().getParent();
            // ROOT·DISCARDED 는 화면에 없는 시스템 태그다. 그 이름('root' 등)을 상위 태그명으로 내보내면
            // 최상위 태그가 "root / 독서" 처럼 표시되므로, 사용자가 만든(CUSTOM) 부모일 때만 이름을 준다.
            String parentTagName = parent != null
                    && parent.getType() == TagType.CUSTOM
                    && memberId.equals(parent.getMember().getId())
                    ? parent.getName() : null;

            long tagTotal = tagRecords.stream().mapToLong(RecordJpaEntity::getTotalTime).sum();
            grandTotal += tagTotal;

            List<SessionDetail> sessions = !includeSessions ? List.of() : tagRecords.stream()
                    .map(r -> new SessionDetail(r.getId(), r.getStartTime(), r.getEndTime(), r.getTotalTime()))
                    .collect(Collectors.toList());

            tagSummaries.add(new TagSummary(entry.getKey(), tagName, parentTagName, tagTotal, tagRecords.size(), sessions));
        }

        tagSummaries.sort(Comparator.comparingLong(TagSummary::getTotalSeconds).reversed());

        return new RecordSummaryResult(grandTotal, tagSummaries, dailyTotals);
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
