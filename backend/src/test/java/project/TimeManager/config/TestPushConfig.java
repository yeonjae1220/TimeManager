package project.TimeManager.config;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import project.TimeManager.application.service.notification.PushSender;
import project.TimeManager.domain.notification.model.PushSubscription;
import project.TimeManager.domain.port.out.notification.LoadPushSubscriptionsPort;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * 통합 테스트용 PushSender 대체 빈.
 * VAPID 키 초기화 없이 No-op으로 동작한다.
 */
@TestConfiguration
public class TestPushConfig {

    @Bean
    @Primary
    public PushSender testPushSender(LoadPushSubscriptionsPort loadPushSubscriptionsPort,
                                     ObjectMapper objectMapper) {
        return new PushSender(loadPushSubscriptionsPort, objectMapper) {
            @Override
            public void init() {
                // No-op: VAPID 초기화 건너뜀
            }

            @Override
            public void sendToMember(Long memberId, String title, String body) {
                // No-op
            }

            @Override
            public void send(PushSubscription sub, String title, String body) {
                // No-op
            }
        };
    }
}
