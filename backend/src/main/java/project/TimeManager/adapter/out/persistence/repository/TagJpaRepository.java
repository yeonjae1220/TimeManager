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

    // 멤버당 RUNNING은 최대 1개가 정상이지만, 과거 reset 결함으로 다중 RUNNING이 남을 수 있어
    // 단건(Optional) 대신 목록으로 조회한다(NonUniqueResultException 방지).
    @Query("SELECT t FROM TagJpaEntity t WHERE t.member.id = :memberId AND t.timerState = :state")
    List<TagJpaEntity> findRunningByMemberId(@Param("memberId") Long memberId,
                                             @Param("state") TimerState state);

    // 삭제 상태 회원의 태그는 제외한다. 회원 조회는 MemberPersistenceAdapter 가 일괄로 걸러주지만
    // 이 쿼리는 태그에서 출발해 회원을 조인하므로 그 관문을 지나지 않는다 — 여기서만 별도로 걸러야
    // 관리자 화면(회원 목록·집계 vs 실행중 타이머)이 서로 다른 회원 집합을 보지 않는다.
    @Query("SELECT t FROM TagJpaEntity t JOIN FETCH t.member m WHERE t.timerState = :state AND m.deletedAt IS NULL")
    List<TagJpaEntity> findAllByTimerState(@Param("state") TimerState state);

    Optional<TagJpaEntity> findByTypeAndMember(TagType type, MemberJpaEntity member);

    @Modifying
    @Query("UPDATE TagJpaEntity t SET t.dailyTotalTime = 0, t.dailyElapsedTime = 0")
    void resetAllDailyTimes();

    @Modifying
    @Query("UPDATE TagJpaEntity t SET t.dailyTotalTime = 0, t.dailyElapsedTime = 0 WHERE t.member.id = :memberId")
    void resetDailyTimesByMemberId(@Param("memberId") Long memberId);

    int countByParent_Id(Long parentId);

    @Modifying
    @Query("UPDATE TagJpaEntity t SET t.displayOrder = :order WHERE t.id = :id")
    void updateDisplayOrder(@Param("id") Long id, @Param("order") int order);
}
