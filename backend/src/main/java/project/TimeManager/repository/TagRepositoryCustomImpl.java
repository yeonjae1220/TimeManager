package project.TimeManager.repository;

import com.querydsl.jpa.impl.JPAQueryFactory;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.dto.QTagDto;
import project.TimeManager.dto.TagDto;
import project.TimeManager.entity.Records;
import project.TimeManager.entity.Tag;

import java.util.List;

import static project.TimeManager.entity.QRecords.*;
import static project.TimeManager.entity.QTag.tag;

@RequiredArgsConstructor
@Repository
@Slf4j
public class TagRepositoryCustomImpl implements TagRepositoryCustom{

    private final EntityManager em;
    private final JPAQueryFactory jpaQueryFactory;


    // only search child depth = 1
//    @Override
//    public List<Tag> findFirstDescendants(Long parentId) {
        /*
        이 부분은 Querydsl에서 별칭(alias)을 생성하기 위해 사용됩니다. 같은 Tag 엔티티를 두 번 이상 참조해야 하는 경우 별칭이 필요합니다.왜 별칭이 필요한가?
        쿼리에서 같은 엔티티(Tag)를 동시에 여러 역할(예: 부모와 자식)로 사용할 때 구분해야 합니다.
        예를 들어, tag.parent는 Tag를 부모로 참조하고, tag 자체는 자식 태그를 나타냅니다.
        별칭(parentTag)을 생성하여 tag.parent를 명확히 구분할 수 있습니다.
        .leftJoin(tag.parent, parentTag) 이 코드를 위해 필요.
        별칭을 정의하지 않고 동일한 엔티티를 여러 번 참조하려 하면 Querydsl은 어느 테이블을 가리키는지 혼동하게 됩니다. 따라서 별칭은 쿼리를 명확하게 작성하고, 복잡한 쿼리에서 오류를 방지하는 데 필수적입니다.
         */
        /*
        QTag parentTag = new QTag("parentTag");

        return jpaQueryFactory
                .select(tag)
                .from(tag)
                .leftJoin(tag.parent, parentTag).fetchJoin()  // 부모와 LEFT JOIN
                .where(tag.id.eq(parentId)  // 최상위 부모 또는
                        .or(tag.parent.id.eq(parentId))) // 그 자식 태그 조건
                .fetch(); // 결과 조회
         */
        /*
        자식 재귀로 쿼리로 돌리는거 일단 실패. only search child depth = 1 만 찾아 보자.
         */


//    }

    //    @Override
//    public List<Tag> findAllDescendantsInTree(Long parentId) {
//        return null;
//    }
    // fetch join 필요?
    @Override
    @Transactional(readOnly = true)
    public List<Records> findRecordsByTag(Tag tag) {
        return jpaQueryFactory
                .selectFrom(records)
                .where(records.tag.id.eq(tag.getId()))
                .fetch();
    }

    @Override
    public void updateTagTimesBatch(List<Long> tagIds, Long deltaTime) {
        log.info("checkpoint3-repository-tagIdList" + tagIds + " deltaTime = " + deltaTime);;
        // 한 번의 쿼리로 여러 태그의 totalTime을 업데이트
        long affectedRows = jpaQueryFactory.update(tag)
                .set(tag.totalTime, tag.totalTime.add(deltaTime)) // totalTime에 deltaTime을 더함
                .where(tag.id.in(tagIds)) // 주어진 tagIds 리스트에 해당하는 태그만 업데이트
                //.and(tag.TotalTime.add(deltaTime).goe(0)))  // totalTime이 음수가 되지 않도록 조건 추가)
                .execute();  // 실행
        log.info("Batch update completed. Affected rows: {}", affectedRows);
//        log.info("Query Updating totalTime for tagIds {}: adding deltaTime {}", tagIds, deltaTime);

        // 캐시 동기화
        em.flush();
        em.clear();

        // 🔹 업데이트된 값들을 DB에서 다시 조회해서 로그 출력
//        List<Tag> updatedTags = em.createQuery(
//                        "SELECT t FROM Tag t WHERE t.id IN :tagIds", Tag.class)
//                .setParameter("tagIds", tagIds)
//                .getResultList();
//
//        for (Tag t : updatedTags) {
//            log.info("Updated Tag - ID: {}, totalTime: {}", t.getId(), t.getTotalTime());
//        }
    }

//    @Override
//    public void updateTagParent(Tag currentTag, Tag ParentTag, Tag newParentTag) {
//        // 부모 태그에서 자식 태그로부터 현재 태그를 제거
//        if (ParentTag != null) {
//            jpaQueryFactory.update(tag)
//                    .set(tag.parent, newParentTag) // 부모를 새로운 부모로 업데이트
//                    .where(tag.id.eq(currentTag.getId())) // 현재 태그를 찾아서 업데이트
//                    .execute();
//
//            // 자식 목록에서 현재 태그를 제거하는 쿼리
//            jpaQueryFactory.update(tag)
//                    .set(tag.children, tag.children.remove(currentTag)) // 자식 목록에서 currentTag를 제거
//                    .where(tag.id.eq(ParentTag.getId())) // ParentTag의 id로 업데이트
//                    .execute();
//        } else {
//            // 부모가 없으면 예외 처리
//            throw new IllegalArgumentException("Tag does not have a parent tag.");
//        }
//
//        // 새 부모에 추가된 자식 태그는 자동으로 추가되어야 한다.
//        newParentTag.getChildren().add(tag);
//        tag.setParent(newTagParent);
//
//        // 변경된 엔티티를 저장
//        tagRepository.save(tag);
//        tagRepository.save(newTagParent);
//    }

    // 컨트롤러 응답을 위해 만든 DTO
    @Override
    public List<TagDto> findTagListDtoByMemberId(Long memberId){
        return jpaQueryFactory
                .select(new QTagDto(
                        tag
                ))
                .from(tag)
                .where(tag.member.id.eq(memberId))
                .fetch();
    }
    // 하나의 tag 정보를 보내기 위한 Dto
    @Override
    public TagDto findOneTagDtoById(Long tagId) {
        return jpaQueryFactory
                .select(new QTagDto(
                        tag
                ))
                .from(tag)
                .where(tag.id.eq(tagId))
                .fetchOne();
    }

}
