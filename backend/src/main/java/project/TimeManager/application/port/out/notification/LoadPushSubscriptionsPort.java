package project.TimeManager.application.port.out.notification;

import project.TimeManager.domain.notification.model.PushSubscription;

import java.util.List;

public interface LoadPushSubscriptionsPort {
    List<PushSubscription> loadAllSubscriptions();
    List<PushSubscription> loadByMemberId(Long memberId);
}
