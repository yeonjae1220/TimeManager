package project.TimeManager.adapter.out.persistence.repository;

import com.querydsl.jpa.impl.JPAQueryFactory;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;
import project.TimeManager.adapter.out.persistence.entity.QTagJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;

import java.util.List;

@Repository
@RequiredArgsConstructor
@Slf4j
public class TagJpaRepositoryCustomImpl implements TagJpaRepositoryCustom {

    private final EntityManager em;
    private final JPAQueryFactory jpaQueryFactory;

    private static final QTagJpaEntity tag = QTagJpaEntity.tagJpaEntity;

    @Override
    public List<TagJpaEntity> findTagsByMemberId(Long memberId) {
        return jpaQueryFactory
                .selectFrom(tag)
                .where(tag.member.id.eq(memberId))
                .fetch();
    }

    @Override
    public void updateTagTimesBatch(List<Long> tagIds, Long deltaTime) {
        log.info("Batch update tagIds={}, deltaTime={}", tagIds, deltaTime);
        long affected = jpaQueryFactory.update(tag)
                .set(tag.totalTime, tag.totalTime.add(deltaTime))
                .where(tag.id.in(tagIds))
                .execute();
        log.info("Batch update completed. Affected rows: {}", affected);

        em.flush();
        em.clear();
    }
}
