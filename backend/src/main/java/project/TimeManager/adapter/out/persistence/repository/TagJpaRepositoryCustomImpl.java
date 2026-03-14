package project.TimeManager.adapter.out.persistence.repository;

import com.querydsl.jpa.impl.JPAQueryFactory;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;
import project.TimeManager.adapter.out.persistence.entity.QTagJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;

import java.util.List;
import java.util.stream.Collectors;

@Repository
@RequiredArgsConstructor
@Slf4j
public class TagJpaRepositoryCustomImpl implements TagJpaRepositoryCustom {

    private final EntityManager em;
    private final JPAQueryFactory jpaQueryFactory;

    private static final QTagJpaEntity tag = QTagJpaEntity.tagJpaEntity;

    @Override
    public List<TagJpaEntity> findTagsByMemberId(Long memberId) {
        // fetchJoin on children to prevent N+1 when toResult() accesses getChildren()
        return jpaQueryFactory
                .selectFrom(tag)
                .leftJoin(tag.children).fetchJoin()
                .where(tag.member.id.eq(memberId))
                .distinct()
                .fetch();
    }

    /**
     * 재귀 CTE로 조상 태그 ID를 한 번의 쿼리로 수집한다.
     * ROOT / DISCARDED 타입에서 탐색을 멈춘다.
     */
    @Override
    @SuppressWarnings("unchecked")
    public List<Long> findAncestorIds(Long startTagId) {
        List<Object> result = em.createNativeQuery(
                "WITH RECURSIVE ancestor_chain(tag_id, parent_id, type) AS (" +
                "  SELECT tag_id, parent_id, type FROM tag WHERE tag_id = :startTagId " +
                "  UNION ALL " +
                "  SELECT t.tag_id, t.parent_id, t.type FROM tag t " +
                "  INNER JOIN ancestor_chain ac ON t.tag_id = ac.parent_id " +
                "  WHERE ac.type NOT IN ('ROOT', 'DISCARDED')" +
                ") SELECT tag_id FROM ancestor_chain"
        )
                .setParameter("startTagId", startTagId)
                .getResultList();

        return result.stream()
                .map(o -> ((Number) o).longValue())
                .collect(Collectors.toList());
    }

    @Override
    public void updateTagTimesBatch(List<Long> tagIds, Long deltaTime) {
        log.info("Batch update tagIds={}, deltaTime={}", tagIds, deltaTime);
        long affected = jpaQueryFactory.update(tag)
                .set(tag.totalTime, tag.totalTime.add(deltaTime))
                .where(tag.id.in(tagIds))
                .execute();
        log.info("Batch update completed. Affected rows: {}", affected);

        // 벌크 업데이트 후 1차 캐시 동기화: 업데이트된 엔티티가 stale 상태가 되는 것을 방지
        em.flush();
        em.clear();
    }
}
