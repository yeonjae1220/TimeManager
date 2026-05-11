package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import project.TimeManager.application.dto.result.RecordResult;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.port.out.member.LoadMemberPort;
import project.TimeManager.domain.port.out.record.LoadRecordsByTagPort;
import project.TimeManager.domain.port.out.tag.LoadTagPort;
import project.TimeManager.domain.port.out.tag.SaveTagPort;
import project.TimeManager.domain.tag.model.Tag;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TagRecordDerivedFieldsSyncService {

    private final LoadTagPort loadTagPort;
    private final LoadRecordsByTagPort loadRecordsByTagPort;
    private final SaveTagPort saveTagPort;
    private final LoadMemberPort loadMemberPort;

    public void sync(Long tagId) {
        Tag tag = loadTagPort.loadTag(tagId)
                .orElseThrow(() -> new DomainException("Tag not found: " + tagId));

        Member member = loadMemberPort.loadMember(tag.getMemberId().value())
                .orElseThrow(() -> new DomainException("Member not found"));
        ZoneId userZone = ZoneId.of(member.getTimezone());
        int resetHour = member.getDailyResetHour();

        List<RecordResult> records = loadRecordsByTagPort.loadRecordsByTagId(tagId);

        long tagTotalTime = records.stream()
                .mapToLong(RecordResult::getTotalTime)
                .sum();

        long dailyTotalTime = records.stream()
                .filter(record -> isToday(record.getStartTime(), userZone, resetHour))
                .mapToLong(RecordResult::getTotalTime)
                .sum();

        RecordResult latestRecord = records.stream()
                .max(Comparator.comparing(RecordResult::getEndTime))
                .orElse(null);

        ZonedDateTime latestStartTime = tag.isRunning()
                ? tag.getLatestStartTime()
                : latestRecord != null ? latestRecord.getStartTime() : null;
        ZonedDateTime latestStopTime = latestRecord != null ? latestRecord.getEndTime() : null;

        tag.synchronizeRecordDerivedFields(tagTotalTime, dailyTotalTime, latestStartTime, latestStopTime);
        saveTagPort.saveTag(tag);
    }

    private boolean isToday(ZonedDateTime sessionTime, ZoneId userZone, int resetHour) {
        ZonedDateTime now = ZonedDateTime.now(userZone);
        ZonedDateTime todayReset = now.toLocalDate().atStartOfDay(userZone).plusHours(resetHour);
        if (now.isBefore(todayReset)) {
            todayReset = todayReset.minusDays(1);
        }
        ZonedDateTime nextReset = todayReset.plusDays(1);
        ZonedDateTime sessionInZone = sessionTime.withZoneSameInstant(userZone);
        return !sessionInZone.isBefore(todayReset) && sessionInZone.isBefore(nextReset);
    }
}
