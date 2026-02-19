package project.TimeManager.adapter.out.persistence.adapter;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import project.TimeManager.adapter.out.persistence.entity.RecordJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.adapter.out.persistence.mapper.RecordMapper;
import project.TimeManager.adapter.out.persistence.repository.RecordJpaRepository;
import project.TimeManager.adapter.out.persistence.repository.TagJpaRepository;
import project.TimeManager.application.dto.result.RecordResult;
import project.TimeManager.application.port.out.record.LoadRecordPort;
import project.TimeManager.application.port.out.record.LoadRecordsByTagPort;
import project.TimeManager.application.port.out.record.SaveRecordPort;
import project.TimeManager.domain.record.model.Record;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class RecordPersistenceAdapter implements LoadRecordPort, SaveRecordPort, LoadRecordsByTagPort {

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

}
