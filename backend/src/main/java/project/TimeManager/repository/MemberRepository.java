package project.TimeManager.repository;

import jakarta.persistence.QueryHint;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import project.TimeManager.entity.Member;

import java.util.List;

public interface MemberRepository extends JpaRepository<Member, Long>, MemberRepositoryCustom {

    //JPQL + 엔티티 그래프
    // 이런 간단한건 JPQL 안쓰고 이렇게 Left fetch join 가능
    @EntityGraph(attributePaths = {"tag"})
    @Query("select m from Member m")
    List<Member> findMemberEntityGraph();

    // forCounting` : 반환 타입으로 `Page` 인터페이스를 적용하면 추가로 호출하는 페이징을 위한 count 쿼리도 쿼리 힌트 적용(기본값 `true` )
    // 근데 이건 이렇게 다 세팅해주면서 수고를 들여도 몇퍼센트 성능 향상이 안된다. 진짜 중요한 트레픽이 많은 api몇개에만 넣어주고, 다 넣어서 최적화 하긴 무리가 있다. 성능 테스트를 해보고 결정을 내리자
    @QueryHints(value = { @QueryHint(name = "org.hibernate.readOnly",
            value = "true")},
            forCounting = true)
    Page<Member> findByName(String name, Pageable pageable);

    // MemberRepositoryCustom에 있는거 쓰고 싶으면
    // List<Member> result = memberRepositoryCostom.findMemberCustom(); 이런 식으로 쓰면 됨
}

