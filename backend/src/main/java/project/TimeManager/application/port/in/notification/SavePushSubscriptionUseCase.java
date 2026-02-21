package project.TimeManager.application.port.in.notification;

import project.TimeManager.adapter.in.web.dto.request.PushSubscribeRequest;

public interface SavePushSubscriptionUseCase {
    void saveSubscription(Long memberId, PushSubscribeRequest request);
    void deleteSubscription(Long memberId, String endpoint);
}
