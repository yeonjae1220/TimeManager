package project.TimeManager.shared.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * 시각을 의존성으로 주입받게 해 "지금 몇 시냐"에 결과가 달라지는 로직을 테스트 가능하게 한다.
 *
 * <p>UTC 로 고정한다. 컨테이너의 기본 타임존에 기대면 배포 환경에 따라 판정이 달라지는데,
 * 하루 경계 계산은 이미 회원별 타임존을 명시적으로 쓰고 있으므로 시스템 타임존이 개입할
 * 여지를 남길 이유가 없다.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
