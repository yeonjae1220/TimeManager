package project.TimeManager.domain.port.out.record;

import project.TimeManager.application.dto.result.RecordResult;

import java.util.List;

public interface LoadRecordsByTagPort {
    List<RecordResult> loadRecordsByTagId(Long tagId);
}
