package project.TimeManager.application.service.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Subscription;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import project.TimeManager.domain.notification.model.PushSubscription;
import project.TimeManager.domain.port.out.notification.LoadPushSubscriptionsPort;

import java.security.Security;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class PushSender {

    private final LoadPushSubscriptionsPort loadPushSubscriptionsPort;
    private final ObjectMapper objectMapper;

    @Value("${push.vapid.publicKey}")
    private String vapidPublicKey;

    @Value("${push.vapid.privateKey}")
    private String vapidPrivateKey;

    @Value("${push.vapid.subject}")
    private String vapidSubject;

    private PushService pushService;

    public PushSender(LoadPushSubscriptionsPort loadPushSubscriptionsPort, ObjectMapper objectMapper) {
        this.loadPushSubscriptionsPort = loadPushSubscriptionsPort;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void init() throws Exception {
        Security.addProvider(new BouncyCastleProvider());
        pushService = new PushService(vapidPublicKey, vapidPrivateKey, vapidSubject);
    }

    public void sendToMember(Long memberId, String title, String body) {
        List<PushSubscription> subs = loadPushSubscriptionsPort.loadByMemberId(memberId);
        subs.forEach(s -> send(s, title, body));
    }

    public void send(PushSubscription sub, String title, String body) {
        try {
            Subscription subscription = new Subscription(
                    sub.getEndpoint(),
                    new Subscription.Keys(sub.getP256dh(), sub.getAuth())
            );
            String payload = objectMapper.writeValueAsString(Map.of("title", title, "body", body));
            Notification notification = new Notification(subscription, payload);
            pushService.send(notification);
            log.info("[Push] 알림 전송 성공: endpoint={}", sub.getEndpoint());
        } catch (Exception e) {
            log.warn("[Push] 알림 전송 실패: endpoint={}, error={}", sub.getEndpoint(), e.getMessage());
        }
    }
}
