package project.TimeManager.adapter.out.persistence.repository;

import com.querydsl.core.Tuple;
import project.TimeManager.adapter.out.persistence.entity.RecordJpaEntity;

import java.time.ZonedDateTime;
import java.util.List;

public interface RecordJpaRepositoryCustom {
    List<RecordJpaEntity> findByTagId(Long tagId);

    Long sumTotalTimeByTagIdAndStartTimeAfter(Long tagId, ZonedDateTime after);

    /**
     * 지정 회원의 모든 태그에 걸쳐 [start, end) 와 겹치는 레코드를 조회합니다.
     * 결과 Tuple 컬럼 순서: record.id, tag.id, tag.name, record.startTime, record.endTime
     */
    List<Tuple> findOverlappingRecords(Long memberId, ZonedDateTime start, ZonedDateTime end, Long excludeRecordId);

    List<RecordJpaEntity> findByMemberIdAndStartTimeBetween(Long memberId, ZonedDateTime start, ZonedDateTime end);
}
