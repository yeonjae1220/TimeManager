package project.TimeManager.application.service.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import project.TimeManager.domain.exception.DomainException;
import java.util.Base64;
import project.TimeManager.application.dto.command.SavePushSubscriptionCommand;
import project.TimeManager.domain.notification.model.PushSubscription;
import project.TimeManager.domain.port.in.notification.SavePushSubscriptionUseCase;
import project.TimeManager.domain.port.out.notification.SavePushSubscriptionPort;

@Slf4j
@Service
@RequiredArgsConstructor
public class PushNotificationService implements SavePushSubscriptionUseCase {

    private final SavePushSubscriptionPort savePushSubscriptionPort;

    @Override
    public void saveSubscription(SavePushSubscriptionCommand command) {
        if (!WebPushEndpoint.isAllowed(command.endpoint())
                || !isKey(command.p256dh(), 65) || !isKey(command.auth(), 16)) {
            throw new DomainException("유효한 웹 푸시 구독 정보가 필요합니다");
        }
        PushSubscription sub = PushSubscription.create(
                command.memberId(),
                command.endpoint(),
                command.p256dh(),
                command.auth()
        );
        savePushSubscriptionPort.save(sub);
        log.info("[Push] 구독 저장: memberId={}", command.memberId());
    }

    @Override
    public void deleteSubscription(Long memberId, String endpoint) {
        savePushSubscriptionPort.deleteByMemberIdAndEndpoint(memberId, endpoint);
        log.info("[Push] 구독 해제: memberId={}", memberId);
    }

    private boolean isKey(String value, int length) {
        if (value == null) return false;
        try {
            byte[] key = Base64.getUrlDecoder().decode(value);
            return key.length == length && (length != 65 || key[0] == 4);
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
