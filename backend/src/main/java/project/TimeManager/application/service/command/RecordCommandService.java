package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.application.dto.command.CreateRecordCommand;
import project.TimeManager.application.dto.command.EditRecordTimeCommand;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.port.in.record.CreateRecordUseCase;
import project.TimeManager.domain.port.in.record.DeleteRecordUseCase;
import project.TimeManager.domain.port.in.record.EditRecordTimeUseCase;
import project.TimeManager.domain.port.out.record.LoadRecordPort;
import project.TimeManager.domain.port.out.record.SaveRecordPort;
import project.TimeManager.domain.port.out.tag.LoadTagPort;
import project.TimeManager.domain.port.out.tag.SaveTagPort;
import project.TimeManager.domain.port.out.tag.UpdateTagTimeBatchPort;
import project.TimeManager.domain.record.model.Record;
import project.TimeManager.domain.record.model.TimeRange;
import project.TimeManager.domain.tag.model.Tag;

import java.util.Optional;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class RecordCommandService implements CreateRecordUseCase, EditRecordTimeUseCase, DeleteRecordUseCase {

    private final LoadTagPort loadTagPort;
    private final SaveTagPort saveTagPort;
    private final LoadRecordPort loadRecordPort;
    private final SaveRecordPort saveRecordPort;
    private final UpdateTagTimeBatchPort updateTagTimeBatchPort;

    @Override
    public Long createRecord(CreateRecordCommand command) {
        Tag tag = loadTagPort.loadTag(command.tagId())
                .orElseThrow(() -> new DomainException("Tag not found: " + command.tagId()));

        TimeRange timeRange = new TimeRange(command.startTime(), command.endTime());
        Record record = Record.create(tag.getId(), timeRange);

        Long recordId = saveRecordPort.saveRecord(record);

        tag.updateTagTotalTime(record.getTotalTime());
        tag.updateDailyTotalTime(record.getTotalTime());
        saveTagPort.saveTag(tag);

        updateTagTimeBatchPort.updateTagTimeBatch(command.tagId(), record.getTotalTime());

        log.info("Record created: tagId={}, recordId={}, totalTime={}", command.tagId(), recordId, record.getTotalTime());
        return recordId;
    }

    @Override
    public Long editRecordTime(EditRecordTimeCommand command) {
        Record record = loadRecordPort.loadRecord(command.recordId())
                .orElseThrow(() -> new DomainException("Record not found: " + command.recordId()));
        long oldTotalTime = record.getTotalTime();

        TimeRange newRange = new TimeRange(command.newStartTime(), command.newEndTime());
        record.editTimeRange(newRange);

        long delta = record.getTotalTime() - oldTotalTime;
        saveRecordPort.saveRecord(record);

        if (delta != 0) {
            updateTagTimeBatchPort.updateTagTimeBatch(record.getTagId().value(), delta);
        }

        return command.recordId();
    }

    @Override
    public boolean deleteRecord(Long recordId) {
        Optional<Record> recordOpt = loadRecordPort.loadRecord(recordId);
        if (recordOpt.isEmpty()) return false;

        Record record = recordOpt.get();
        long delta = -record.getTotalTime();
        Long tagId = record.getTagId().value();

        saveRecordPort.deleteRecord(recordId);
        updateTagTimeBatchPort.updateTagTimeBatch(tagId, delta);
        return true;
    }
}
