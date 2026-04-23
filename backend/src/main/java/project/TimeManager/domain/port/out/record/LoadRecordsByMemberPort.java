package project.TimeManager.domain.port.out.record;

import project.TimeManager.adapter.out.persistence.entity.RecordJpaEntity;

import java.time.ZonedDateTime;
import java.util.List;

public interface LoadRecordsByMemberPort {
    List<RecordJpaEntity> loadRecordsByMemberAndDateRange(Long memberId, ZonedDateTime start, ZonedDateTime end);
}
