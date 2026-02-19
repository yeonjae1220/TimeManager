package project.TimeManager.application.service.query;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.application.dto.result.RecordResult;
import project.TimeManager.application.port.in.record.GetRecordListQuery;
import project.TimeManager.application.port.out.record.LoadRecordsByTagPort;

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
}
