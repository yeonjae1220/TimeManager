package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import project.TimeManager.application.dto.result.RecordResult;
import project.TimeManager.domain.exception.DomainException;
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

    public void sync(Long tagId) {
        Tag tag = loadTagPort.loadTag(tagId)
                .orElseThrow(() -> new DomainException("Tag not found: " + tagId));

        List<RecordResult> records = loadRecordsByTagPort.loadRecordsByTagId(tagId);

        long tagTotalTime = records.stream()
                .mapToLong(RecordResult::getTotalTime)
                .sum();

        long dailyTotalTime = records.stream()
                .filter(record -> isToday(record.getStartTime()))
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

    private static final ZoneId USER_ZONE = ZoneId.of("Asia/Seoul");
    private static final int DAILY_RESET_HOUR = 5; // 새벽 5시 기준 (Phase 2에서 사용자별 설정으로 확장 예정)

    private boolean isToday(ZonedDateTime sessionTime) {
        ZonedDateTime now = ZonedDateTime.now(USER_ZONE);
        ZonedDateTime todayReset = now.toLocalDate().atStartOfDay(USER_ZONE).plusHours(DAILY_RESET_HOUR);
        if (now.isBefore(todayReset)) {
            todayReset = todayReset.minusDays(1);
        }
        ZonedDateTime nextReset = todayReset.plusDays(1);
        ZonedDateTime sessionInZone = sessionTime.withZoneSameInstant(USER_ZONE);
        return !sessionInZone.isBefore(todayReset) && sessionInZone.isBefore(nextReset);
    }
}
