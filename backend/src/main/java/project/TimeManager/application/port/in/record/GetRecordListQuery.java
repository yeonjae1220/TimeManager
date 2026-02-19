package project.TimeManager.application.port.in.record;

import project.TimeManager.application.dto.result.RecordResult;

import java.util.List;

public interface GetRecordListQuery {
    List<RecordResult> getRecordsByTagId(Long tagId);
}
