package project.TimeManager.domain.port.in.notification;

import project.TimeManager.application.dto.command.SavePushSubscriptionCommand;

public interface SavePushSubscriptionUseCase {
    void saveSubscription(SavePushSubscriptionCommand command);
    void deleteSubscription(Long memberId, String endpoint);
}
