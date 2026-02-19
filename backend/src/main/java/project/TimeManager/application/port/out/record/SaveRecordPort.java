package project.TimeManager.application.port.out.record;

import project.TimeManager.domain.record.model.Record;

public interface SaveRecordPort {
    Long saveRecord(Record record);

    void deleteRecord(Long recordId);
}
