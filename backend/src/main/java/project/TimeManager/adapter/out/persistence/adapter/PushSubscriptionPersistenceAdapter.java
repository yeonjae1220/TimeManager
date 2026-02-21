package project.TimeManager.adapter.out.persistence.adapter;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.adapter.out.persistence.entity.PushSubscriptionJpaEntity;
import project.TimeManager.adapter.out.persistence.repository.PushSubscriptionRepository;
import project.TimeManager.application.port.out.notification.LoadPushSubscriptionsPort;
import project.TimeManager.application.port.out.notification.SavePushSubscriptionPort;
import project.TimeManager.domain.notification.model.PushSubscription;

import java.util.List;

@Component
@RequiredArgsConstructor
public class PushSubscriptionPersistenceAdapter implements SavePushSubscriptionPort, LoadPushSubscriptionsPort {

    private final PushSubscriptionRepository repository;

    @Override
    @Transactional
    public void save(PushSubscription subscription) {
        // 같은 endpoint가 이미 존재하면 중복 저장하지 않음
        if (repository.findAll().stream()
                .anyMatch(e -> e.getEndpoint().equals(subscription.getEndpoint()))) {
            return;
        }
        repository.save(new PushSubscriptionJpaEntity(
                subscription.getMemberId(),
                subscription.getEndpoint(),
                subscription.getP256dh(),
                subscription.getAuth()
        ));
    }

    @Override
    @Transactional
    public void deleteByEndpoint(String endpoint) {
        repository.deleteByEndpoint(endpoint);
    }

    @Override
    public List<PushSubscription> loadAllSubscriptions() {
        return repository.findAll().stream().map(this::toDomain).toList();
    }

    @Override
    public List<PushSubscription> loadByMemberId(Long memberId) {
        return repository.findByMemberId(memberId).stream().map(this::toDomain).toList();
    }

    private PushSubscription toDomain(PushSubscriptionJpaEntity e) {
        return PushSubscription.reconstitute(e.getId(), e.getMemberId(), e.getEndpoint(), e.getP256dh(), e.getAuth());
    }
}
