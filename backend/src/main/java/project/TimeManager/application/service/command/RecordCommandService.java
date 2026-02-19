package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.adapter.out.persistence.adapter.RecordPersistenceAdapter;
import project.TimeManager.adapter.out.persistence.adapter.TagPersistenceAdapter;
import project.TimeManager.adapter.out.persistence.entity.RecordJpaEntity;
import project.TimeManager.application.dto.command.CreateRecordCommand;
import project.TimeManager.application.dto.command.EditRecordTimeCommand;
import project.TimeManager.application.port.in.record.CreateRecordUseCase;
import project.TimeManager.application.port.in.record.DeleteRecordUseCase;
import project.TimeManager.application.port.in.record.EditRecordTimeUseCase;
import project.TimeManager.application.port.out.record.LoadRecordPort;
import project.TimeManager.application.port.out.record.SaveRecordPort;
import project.TimeManager.application.port.out.tag.LoadTagPort;
import project.TimeManager.application.port.out.tag.SaveTagPort;
import project.TimeManager.application.port.out.tag.UpdateTagTimeBatchPort;
import project.TimeManager.domain.record.model.Record;
import project.TimeManager.domain.record.model.TimeRange;
import project.TimeManager.domain.shared.DomainException;
import project.TimeManager.domain.tag.model.Tag;

import java.time.ZonedDateTime;

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
    private final TagPersistenceAdapter tagPersistenceAdapter;
    private final RecordPersistenceAdapter recordPersistenceAdapter;

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

    /**
     * 타이머를 정지하고 경과 시간을 저장한 뒤 기록을 생성한다.
     * TimerCommandService에서 호출.
     */
    public Long stopAndSaveRecord(Long tagId, Long elapsedTime, ZonedDateTime startTime, ZonedDateTime endTime) {
        Tag tag = loadTagPort.loadTag(tagId)
                .orElseThrow(() -> new DomainException("Tag not found: " + tagId));

        tag.stop(endTime, elapsedTime);
        saveTagPort.saveTag(tag);

        return createRecord(new CreateRecordCommand(tagId, startTime, endTime));
    }

    @Override
    public Long editRecordTime(EditRecordTimeCommand command) {
        RecordJpaEntity entity = recordPersistenceAdapter.loadJpaEntity(command.recordId());
        long oldTotalTime = entity.getTotalTime();

        // TimeRange 생성 시 도메인 불변식 검증 (null, end > start)
        TimeRange newRange = new TimeRange(command.newStartTime(), command.newEndTime());

        entity.setStartTime(newRange.start());
        entity.setEndTime(newRange.end());
        long newTotalTime = newRange.durationInSeconds();
        entity.setTotalTime(newTotalTime);

        long delta = newTotalTime - oldTotalTime;
        if (delta != 0) {
            updateTagTimeBatchPort.updateTagTimeBatch(entity.getTag().getId(), delta);
        }

        return command.recordId();
    }

    @Override
    public boolean deleteRecord(Long recordId) {
        RecordJpaEntity entity = recordPersistenceAdapter.loadJpaEntity(recordId);
        if (entity == null) return false;

        long delta = -entity.getTotalTime();
        Long tagId = entity.getTag().getId();

        saveRecordPort.deleteRecord(recordId);
        updateTagTimeBatchPort.updateTagTimeBatch(tagId, delta);
        return true;
    }
}
