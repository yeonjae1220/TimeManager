package project.TimeManager.application.port.out.notification;

import project.TimeManager.domain.notification.model.PushSubscription;

public interface SavePushSubscriptionPort {
    void save(PushSubscription subscription);
    void deleteByEndpoint(String endpoint);
}
