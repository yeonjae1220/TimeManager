package project.TimeManager;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import project.TimeManager.application.service.notification.PushSender;

@SpringBootTest
class TimeManagerApplicationTests {

    @MockBean PushSender pushSender;

    @Test
    @DisplayName("Spring 컨텍스트가 정상적으로 로드된다")
    void contextLoads() {
        // Spring ApplicationContext 로드 성공 시 통과
    }
}
