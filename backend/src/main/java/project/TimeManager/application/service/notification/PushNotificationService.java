package project.TimeManager.application.service.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Subscription;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import project.TimeManager.adapter.in.web.dto.request.PushSubscribeRequest;
import project.TimeManager.application.port.in.notification.SavePushSubscriptionUseCase;
import project.TimeManager.application.port.out.notification.LoadPushSubscriptionsPort;
import project.TimeManager.application.port.out.notification.SavePushSubscriptionPort;
import project.TimeManager.domain.notification.model.PushSubscription;

import jakarta.annotation.PostConstruct;
import java.security.Security;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PushNotificationService implements SavePushSubscriptionUseCase {

    private final SavePushSubscriptionPort savePushSubscriptionPort;
    private final LoadPushSubscriptionsPort loadPushSubscriptionsPort;

    @Value("${push.vapid.publicKey}")
    private String vapidPublicKey;

    @Value("${push.vapid.privateKey}")
    private String vapidPrivateKey;

    @Value("${push.vapid.subject}")
    private String vapidSubject;

    private PushService pushService;

    @PostConstruct
    public void init() throws Exception {
        Security.addProvider(new BouncyCastleProvider());
        pushService = new PushService(vapidPublicKey, vapidPrivateKey, vapidSubject);
    }

    // ── 구독 저장 ──────────────────────────────────────────────────────
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

    // ── 알림 전송 ──────────────────────────────────────────────────────
    public void sendNotification(PushSubscription sub, String title, String body) {
        try {
            Subscription subscription = new Subscription(
                    sub.getEndpoint(),
                    new Subscription.Keys(sub.getP256dh(), sub.getAuth())
            );
            String payload = String.format(
                    "{\"title\":\"%s\",\"body\":\"%s\"}", escape(title), escape(body)
            );
            Notification notification = new Notification(subscription, payload);
            pushService.send(notification);
            log.info("[Push] 알림 전송 성공: endpoint={}", sub.getEndpoint());
        } catch (Exception e) {
            log.warn("[Push] 알림 전송 실패: endpoint={}, error={}", sub.getEndpoint(), e.getMessage());
        }
    }

    public void sendToMember(Long memberId, String title, String body) {
        List<PushSubscription> subs = loadPushSubscriptionsPort.loadByMemberId(memberId);
        subs.forEach(s -> sendNotification(s, title, body));
    }

    // ── 스케줄러: 매 시간 일일 목표 달성 확인 ─────────────────────────
    // 실제 구현에서는 TagRepository를 통해 오늘 dailyTotalTime >= dailyGoalTime인
    // 태그를 조회하여 알림을 전송해야 합니다. 아래는 구조 시연용 스텁입니다.
    @Scheduled(cron = "0 0 * * * *")  // 매 시간 정각
    public void checkDailyGoals() {
        log.info("[Push] 일일 목표 달성 여부 확인 스케줄러 실행");
        // TODO: TagService를 주입받아 오늘 목표를 달성한 (memberId, tagName) 목록을 조회하고
        //       sendToMember(memberId, "목표 달성!", tagName + " 일일 목표를 달성했습니다.") 호출
    }

    private String escape(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
