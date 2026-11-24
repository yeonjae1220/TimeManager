package project.TimeManager.adapter.out.persistence.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import project.TimeManager.adapter.out.persistence.entity.PushSubscriptionJpaEntity;

import java.util.List;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscriptionJpaEntity, Long> {
    List<PushSubscriptionJpaEntity> findByMemberId(Long memberId);
    boolean existsByEndpoint(String endpoint);
    void deleteByMemberIdAndEndpoint(Long memberId, String endpoint);
    void deleteByMemberId(Long memberId);
}
