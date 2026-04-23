package project.TimeManager.adapter.out.persistence.adapter;

import com.querydsl.core.Tuple;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import project.TimeManager.adapter.out.persistence.entity.QRecordJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.RecordJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.adapter.out.persistence.mapper.RecordMapper;
import project.TimeManager.adapter.out.persistence.repository.RecordJpaRepository;
import project.TimeManager.adapter.out.persistence.repository.TagJpaRepository;
import project.TimeManager.application.dto.result.RecordResult;
import project.TimeManager.domain.port.out.record.FindOverlappingRecordsPort;
import project.TimeManager.domain.port.out.record.LoadRecordPort;
import project.TimeManager.domain.port.out.record.LoadRecordsByMemberPort;
import project.TimeManager.domain.port.out.record.LoadRecordsByTagPort;
import project.TimeManager.domain.port.out.record.SaveRecordPort;
import project.TimeManager.domain.record.model.Record;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class RecordPersistenceAdapter implements LoadRecordPort, SaveRecordPort, LoadRecordsByTagPort, FindOverlappingRecordsPort, LoadRecordsByMemberPort {

    private final RecordJpaRepository recordJpaRepository;
    private final TagJpaRepository tagJpaRepository;
    private final RecordMapper recordMapper;

    @Override
    public Optional<Record> loadRecord(Long recordId) {
        return recordJpaRepository.findById(recordId)
                .map(recordMapper::toDomain);
    }

    @Override
    public Long saveRecord(Record domain) {
        if (domain.getId() != null) {
            RecordJpaEntity entity = recordJpaRepository.findById(domain.getId().value())
                    .orElseThrow(() -> new EntityNotFoundException("Record not found: " + domain.getId().value()));
            entity.setStartTime(domain.getTimeRange().start());
            entity.setEndTime(domain.getTimeRange().end());
            entity.setTotalTime(domain.getTotalTime());
            return recordJpaRepository.save(entity).getId();
        }
        TagJpaEntity tag = tagJpaRepository.getReferenceById(domain.getTagId().value());
        return recordJpaRepository.save(recordMapper.toNewJpaEntity(domain, tag)).getId();
    }

    @Override
    public void deleteRecord(Long recordId) {
        recordJpaRepository.deleteById(recordId);
    }

    @Override
    public List<RecordResult> loadRecordsByTagId(Long tagId) {
        return recordJpaRepository.findByTagId(tagId).stream()
                .map(recordMapper::toResult)
                .collect(Collectors.toList());
    }

    @Override
    public List<RecordJpaEntity> loadRecordsByMemberAndDateRange(Long memberId, ZonedDateTime start, ZonedDateTime end) {
        return recordJpaRepository.findByMemberIdAndStartTimeBetween(memberId, start, end);
    }

    @Override
    public List<OverlapResult> findOverlappingRecords(Long memberId, ZonedDateTime start, ZonedDateTime end, Long excludeRecordId) {
        // Tuple 컬럼 키는 CustomImpl의 .select() 에서 사용한 경로와 동일해야 합니다.
        QRecordJpaEntity r = QRecordJpaEntity.recordJpaEntity;

        return recordJpaRepository.findOverlappingRecords(memberId, start, end, excludeRecordId)
                .stream()
                .map(tuple -> new OverlapResult(
                        tuple.get(r.id),
                        tuple.get(r.tag.id),
                        tuple.get(r.tag.name),
                        tuple.get(r.startTime),
                        tuple.get(r.endTime)
                ))
                .collect(Collectors.toList());
    }

}
