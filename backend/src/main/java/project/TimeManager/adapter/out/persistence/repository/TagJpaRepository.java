package project.TimeManager.adapter.out.persistence.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import project.TimeManager.adapter.out.persistence.entity.MemberJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.domain.tag.model.TagType;

import java.util.List;
import java.util.Optional;

public interface TagJpaRepository extends JpaRepository<TagJpaEntity, Long>, TagJpaRepositoryCustom {

    @Query("SELECT t FROM TagJpaEntity t WHERE t.member.id = :memberId")
    List<TagJpaEntity> findByMemberId(Long memberId);

    Optional<TagJpaEntity> findByTypeAndMember(TagType type, MemberJpaEntity member);
}
