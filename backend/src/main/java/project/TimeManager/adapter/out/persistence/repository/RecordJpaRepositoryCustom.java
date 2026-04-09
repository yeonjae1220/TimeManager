package project.TimeManager.adapter.out.persistence.repository;

import project.TimeManager.adapter.out.persistence.entity.RecordJpaEntity;

import java.time.ZonedDateTime;
import java.util.List;

public interface RecordJpaRepositoryCustom {
    List<RecordJpaEntity> findByTagId(Long tagId);

    Long sumTotalTimeByTagIdAndStartTimeAfter(Long tagId, ZonedDateTime after);
}
