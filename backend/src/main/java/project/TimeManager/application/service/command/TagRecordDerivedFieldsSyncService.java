package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import project.TimeManager.application.dto.result.RecordResult;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.port.out.record.LoadRecordsByTagPort;
import project.TimeManager.domain.port.out.tag.LoadTagPort;
import project.TimeManager.domain.port.out.tag.SaveTagPort;
import project.TimeManager.domain.tag.model.Tag;

import java.time.LocalDate;
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

    private boolean isToday(ZonedDateTime dateTime) {
        return dateTime.toLocalDate().equals(LocalDate.now(dateTime.getZone()));
    }
}
