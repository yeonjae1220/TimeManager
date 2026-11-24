package project.TimeManager.application.service.query;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.application.dto.result.RecordResult;
import project.TimeManager.domain.port.in.record.GetRecordListQuery;
import project.TimeManager.domain.port.out.record.LoadRecordsByTagPort;

import java.time.ZonedDateTime;
import java.util.List;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class RecordQueryService implements GetRecordListQuery {

    private final LoadRecordsByTagPort loadRecordsByTagPort;

    @Override
    public List<RecordResult> getRecordsByTagId(Long tagId) {
        return loadRecordsByTagPort.loadRecordsByTagId(tagId);
    }

    @Override
    public List<RecordResult> getRecordPage(Long tagId, ZonedDateTime before, Long beforeId, int limit) {
        return loadRecordsByTagPort.loadRecordPage(tagId, before, beforeId, limit);
    }
}
