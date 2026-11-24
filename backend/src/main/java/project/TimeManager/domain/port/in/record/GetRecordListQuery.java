package project.TimeManager.domain.port.in.record;

import project.TimeManager.application.dto.result.RecordResult;

import java.time.ZonedDateTime;
import java.util.List;

public interface GetRecordListQuery {
    List<RecordResult> getRecordsByTagId(Long tagId);
    List<RecordResult> getRecordPage(Long tagId, ZonedDateTime before, Long beforeId, int limit);
}
