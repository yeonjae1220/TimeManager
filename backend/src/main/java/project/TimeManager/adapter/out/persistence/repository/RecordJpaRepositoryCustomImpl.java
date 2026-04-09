package project.TimeManager.adapter.out.persistence.repository;

import com.querydsl.jpa.impl.JPAQueryFactory;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;
import project.TimeManager.adapter.out.persistence.entity.QRecordJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.RecordJpaEntity;

import java.util.List;

@Repository
@RequiredArgsConstructor
@Slf4j
public class RecordJpaRepositoryCustomImpl implements RecordJpaRepositoryCustom {

    private final EntityManager em;
    private final JPAQueryFactory jpaQueryFactory;

    private static final QRecordJpaEntity record = QRecordJpaEntity.recordJpaEntity;

    @Override
    public List<RecordJpaEntity> findByTagId(Long tagId) {
        return jpaQueryFactory
                .selectFrom(record)
                .where(record.tag.id.eq(tagId))
                .orderBy(record.startTime.desc())
                .fetch();
    }

    @Override
    public Long sumTotalTimeByTagIdAndStartTimeAfter(Long tagId, java.time.ZonedDateTime after) {
        Long sum = jpaQueryFactory
                .select(record.totalTime.sum())
                .from(record)
                .where(record.tag.id.eq(tagId)
                        .and(record.startTime.goe(after)))
                .fetchOne();
        return sum != null ? sum : 0L;
    }
}
