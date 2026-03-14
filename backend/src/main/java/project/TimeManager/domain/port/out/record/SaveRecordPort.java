package project.TimeManager.domain.port.out.record;

import project.TimeManager.domain.record.model.Record;

public interface SaveRecordPort {
    Long saveRecord(Record record);

    void deleteRecord(Long recordId);
}
