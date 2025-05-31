package project.TimeManager.repository;

import jakarta.persistence.QueryHint;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;
import project.TimeManager.entity.Member;
import project.TimeManager.entity.Tag;
import project.TimeManager.entity.TagType;

import java.util.List;
import java.util.Optional;

public interface TagRepository extends JpaRepository<Tag, Long>, TagRepositoryCustom {

    // Fetch Join을 사용하면 페이징이 잘 안될 수 있다.
//    @Query("select t from Tag t left join fetch t.children where t.id = :parentId")
//    List<Tag> findWithChildrenByParentId(@Param("parentId") Long parentId);

    @QueryHints(value = { @QueryHint(name = "org.hibernate.readOnly",
            value = "true")},
            forCounting = true)
    Page<Tag> findByName(String name, Pageable pageable);

    Optional<Tag> findByName(String name);

    @Query("SELECT t FROM Tag t WHERE t.member.id = :memberId")
    List<Tag> findTagListByMemberId(Long memberId);


    // 첫번째 자식들 리스트 반환
    List<Tag> findByParentId(Long id);

    // 특정 멤버의 태그 이름으로 태그 검색
    @Query("SELECT t FROM Tag t WHERE t.member.id = :memberId AND t.name = :tagName")
    Optional<Tag> findByMemberIdAndTagName(@Param("memberId") Long memberId, @Param("tagName") String tagName);

    // Find a tag by type and member
    Optional<Tag> findByTypeAndMember(TagType type, Member member);

}
