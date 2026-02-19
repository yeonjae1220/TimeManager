package project.TimeManager.adapter.out.persistence.mapper;

import org.springframework.stereotype.Component;
import project.TimeManager.adapter.out.persistence.entity.RecordJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.application.dto.result.RecordResult;
import project.TimeManager.domain.record.model.Record;
import project.TimeManager.domain.record.model.RecordId;
import project.TimeManager.domain.record.model.TimeRange;
import project.TimeManager.domain.tag.model.TagId;

@Component
public class RecordMapper {

    public Record toDomain(RecordJpaEntity entity) {
        return Record.reconstitute(
                RecordId.of(entity.getId()),
                TagId.of(entity.getTag().getId()),
                new TimeRange(entity.getStartTime(), entity.getEndTime()),
                entity.getTotalTime()
        );
    }

    public RecordJpaEntity toNewJpaEntity(Record domain, TagJpaEntity tag) {
        return new RecordJpaEntity(tag, domain.getTimeRange().start(), domain.getTimeRange().end());
    }

    public RecordResult toResult(RecordJpaEntity entity) {
        return new RecordResult(
                entity.getId(),
                entity.getStartTime(),
                entity.getEndTime(),
                entity.getTotalTime()
        );
    }
}
