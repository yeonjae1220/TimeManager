package project.TimeManager.application.service.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import project.TimeManager.adapter.in.web.dto.request.PushSubscribeRequest;
import project.TimeManager.domain.notification.model.PushSubscription;
import project.TimeManager.domain.port.in.notification.SavePushSubscriptionUseCase;
import project.TimeManager.domain.port.out.notification.SavePushSubscriptionPort;

@Slf4j
@Service
@RequiredArgsConstructor
public class PushNotificationService implements SavePushSubscriptionUseCase {

    private final SavePushSubscriptionPort savePushSubscriptionPort;

    @Override
    public void saveSubscription(Long memberId, PushSubscribeRequest request) {
        PushSubscription sub = PushSubscription.create(
                memberId,
                request.endpoint(),
                request.getP256dh(),
                request.getAuth()
        );
        savePushSubscriptionPort.save(sub);
        log.info("[Push] 구독 저장: memberId={}, endpoint={}", memberId, request.endpoint());
    }

    @Override
    public void deleteSubscription(Long memberId, String endpoint) {
        savePushSubscriptionPort.deleteByEndpoint(endpoint);
        log.info("[Push] 구독 해제: memberId={}, endpoint={}", memberId, endpoint);
    }
}
