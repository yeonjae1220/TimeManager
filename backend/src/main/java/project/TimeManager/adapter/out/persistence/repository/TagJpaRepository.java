package project.TimeManager.adapter.out.persistence.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import project.TimeManager.adapter.out.persistence.entity.MemberJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.domain.tag.model.TagType;
import project.TimeManager.domain.tag.model.TimerState;

import java.util.List;
import java.util.Optional;

public interface TagJpaRepository extends JpaRepository<TagJpaEntity, Long>, TagJpaRepositoryCustom {

    @Query("SELECT t FROM TagJpaEntity t WHERE t.member.id = :memberId")
    List<TagJpaEntity> findByMemberId(Long memberId);

    @Query("SELECT t FROM TagJpaEntity t WHERE t.member.id = :memberId AND t.timerState = :state")
    Optional<TagJpaEntity> findRunningByMemberId(@Param("memberId") Long memberId,
                                                  @Param("state") TimerState state);

    Optional<TagJpaEntity> findByTypeAndMember(TagType type, MemberJpaEntity member);

    @Modifying
    @Query("UPDATE TagJpaEntity t SET t.dailyTotalTime = 0, t.dailyElapsedTime = 0")
    void resetAllDailyTimes();

    int countByParent_Id(Long parentId);

    @Modifying
    @Query("UPDATE TagJpaEntity t SET t.displayOrder = :order WHERE t.id = :id")
    void updateDisplayOrder(@Param("id") Long id, @Param("order") int order);
}
