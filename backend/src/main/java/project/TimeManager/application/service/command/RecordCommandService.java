package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.application.dto.command.CreateRecordCommand;
import project.TimeManager.application.dto.command.EditRecordTimeCommand;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.exception.RecordOverlapException;
import project.TimeManager.domain.port.in.record.CreateRecordUseCase;
import project.TimeManager.domain.port.in.record.DeleteRecordUseCase;
import project.TimeManager.domain.port.in.record.EditRecordTimeUseCase;
import project.TimeManager.domain.port.out.record.FindOverlappingRecordsPort;
import project.TimeManager.domain.port.out.record.FindOverlappingRecordsPort.OverlapResult;
import project.TimeManager.domain.port.out.record.LoadRecordPort;
import project.TimeManager.domain.port.out.record.SaveRecordPort;
import project.TimeManager.domain.port.out.tag.LoadTagPort;
import project.TimeManager.domain.port.out.tag.UpdateTagTimeBatchPort;
import project.TimeManager.domain.record.model.Record;
import project.TimeManager.domain.record.model.TimeRange;
import project.TimeManager.domain.tag.model.Tag;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class RecordCommandService implements CreateRecordUseCase, EditRecordTimeUseCase, DeleteRecordUseCase {

    private final LoadTagPort loadTagPort;
    private final LoadRecordPort loadRecordPort;
    private final SaveRecordPort saveRecordPort;
    private final UpdateTagTimeBatchPort updateTagTimeBatchPort;
    private final FindOverlappingRecordsPort findOverlappingRecordsPort;
    private final TagRecordDerivedFieldsSyncService tagRecordDerivedFieldsSyncService;

    @Override
    public Long createRecord(CreateRecordCommand command) {
        Tag tag = loadTagPort.loadTag(command.tagId())
                .orElseThrow(() -> new DomainException("Tag not found: " + command.tagId()));

        TimeRange timeRange = new TimeRange(command.startTime(), command.endTime());

        // 중복 검사 — 같은 회원의 모든 태그에 걸쳐 시간대가 겹치는지 확인
        List<OverlapResult> overlaps = findOverlappingRecordsPort.findOverlappingRecords(
                tag.getMemberId().value(), command.startTime(), command.endTime(), null);
        if (!overlaps.isEmpty() && !command.forceOverwrite()) {
            throw new RecordOverlapException(overlaps);
        }
        Set<Long> affectedTagIds = new HashSet<>();
        affectedTagIds.add(command.tagId());
        if (!overlaps.isEmpty()) {
            affectedTagIds.addAll(deleteOverlappingRecords(overlaps));
        }

        Record record = Record.create(tag.getId(), timeRange);

        Long recordId = saveRecordPort.saveRecord(record);

        updateTagTimeBatchPort.updateTagTimeBatch(command.tagId(), record.getTotalTime());
        affectedTagIds.forEach(tagRecordDerivedFieldsSyncService::sync);

        log.info("Record created: tagId={}, recordId={}, totalTime={}", command.tagId(), recordId, record.getTotalTime());
        return recordId;
    }

    @Override
    public Long editRecordTime(EditRecordTimeCommand command) {
        Record record = loadRecordPort.loadRecord(command.recordId())
                .orElseThrow(() -> new DomainException("Record not found: " + command.recordId()));

        Tag tag = loadTagPort.loadTag(record.getTagId().value())
                .orElseThrow(() -> new DomainException("Tag not found: " + record.getTagId().value()));

        if (!tag.getMemberId().value().equals(command.memberId())) {
            throw new DomainException("접근 권한이 없습니다");
        }

        long oldTotalTime = record.getTotalTime();
        TimeRange newRange = new TimeRange(command.newStartTime(), command.newEndTime());

        // 중복 검사 — 자기 자신(excludeRecordId)은 제외하고 검사
        List<OverlapResult> overlaps = findOverlappingRecordsPort.findOverlappingRecords(
                tag.getMemberId().value(), command.newStartTime(), command.newEndTime(), command.recordId());
        if (!overlaps.isEmpty() && !command.forceOverwrite()) {
            throw new RecordOverlapException(overlaps);
        }
        Set<Long> affectedTagIds = new HashSet<>();
        affectedTagIds.add(record.getTagId().value());

        if (!overlaps.isEmpty()) {
            affectedTagIds.addAll(deleteOverlappingRecords(overlaps));
        }

        record.editTimeRange(newRange);
        long delta = record.getTotalTime() - oldTotalTime;
        saveRecordPort.saveRecord(record);

        if (delta != 0) {
            updateTagTimeBatchPort.updateTagTimeBatch(record.getTagId().value(), delta);
        }

        if (!affectedTagIds.isEmpty()) {
            affectedTagIds.forEach(tagRecordDerivedFieldsSyncService::sync);
        }

        return command.recordId();
    }

    @Override
    public boolean deleteRecord(Long recordId, Long memberId) {
        Optional<Record> recordOpt = loadRecordPort.loadRecord(recordId);
        if (recordOpt.isEmpty()) return false;

        Record record = recordOpt.get();
        Long tagId = record.getTagId().value();

        Tag tag = loadTagPort.loadTag(tagId)
                .orElseThrow(() -> new DomainException("Tag not found: " + tagId));

        if (!tag.getMemberId().value().equals(memberId)) {
            throw new DomainException("접근 권한이 없습니다");
        }

        long delta = -record.getTotalTime();
        saveRecordPort.deleteRecord(recordId);
        updateTagTimeBatchPort.updateTagTimeBatch(tagId, delta);

        tagRecordDerivedFieldsSyncService.sync(tagId);

        return true;
    }

    /**
     * 겹치는 레코드를 삭제하고 태그의 totalTime / dailyTotalTime을 역산합니다.
     */
    private Set<Long> deleteOverlappingRecords(List<OverlapResult> overlaps) {
        Set<Long> affectedTagIds = new HashSet<>();
        for (OverlapResult overlap : overlaps) {
            Record toDelete = loadRecordPort.loadRecord(overlap.recordId())
                    .orElseThrow(() -> new DomainException("Record not found: " + overlap.recordId()));
            long delta = -toDelete.getTotalTime();
            affectedTagIds.add(overlap.tagId());

            saveRecordPort.deleteRecord(overlap.recordId());
            updateTagTimeBatchPort.updateTagTimeBatch(overlap.tagId(), delta);
        }
        return affectedTagIds;
    }

}
