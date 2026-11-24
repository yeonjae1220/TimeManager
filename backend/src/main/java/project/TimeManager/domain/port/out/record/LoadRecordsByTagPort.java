package project.TimeManager.domain.port.out.record;

import project.TimeManager.application.dto.result.RecordResult;

import java.time.ZonedDateTime;
import java.util.List;

public interface LoadRecordsByTagPort {
    List<RecordResult> loadRecordsByTagId(Long tagId);
    List<RecordResult> loadRecordPage(Long tagId, ZonedDateTime before, Long beforeId, int limit);
}
