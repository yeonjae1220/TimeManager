package project.TimeManager.application.port.out.record;

import project.TimeManager.domain.record.model.Record;

import java.util.Optional;

public interface LoadRecordPort {
    Optional<Record> loadRecord(Long recordId);
}
