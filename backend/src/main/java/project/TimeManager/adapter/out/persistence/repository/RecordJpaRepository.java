package project.TimeManager.adapter.out.persistence.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import project.TimeManager.adapter.out.persistence.entity.RecordJpaEntity;

public interface RecordJpaRepository extends JpaRepository<RecordJpaEntity, Long>, RecordJpaRepositoryCustom {

    /**
     * 회원의 기록을 한 방에 지운다. 엔티티를 메모리로 올리지 않으므로 기록이 수만 건이어도
     * 쿼리 하나로 끝난다 — 계정 삭제는 사용자가 응답을 기다리는 동기 요청이다.
     *
     * 서브쿼리로 태그를 고르는 이유: 벌크 delete 문에서는 조인을 쓸 수 없어
     * r.tag.member.id 같은 암묵 조인 경로가 성립하지 않는다. r.tag.id 는 조인 없이
     * 외래키 컬럼을 그대로 읽는다.
     *
     * clearAutomatically: 벌크 연산은 영속성 컨텍스트를 우회하므로, 이미 로드된
     * 기록 엔티티가 남아 있으면 이후 조회가 지워진 행을 되살려 보여준다.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from RecordJpaEntity r where r.tag.id in "
            + "(select t.id from TagJpaEntity t where t.member.id = :memberId)")
    int deleteByMemberId(@Param("memberId") Long memberId);
}
