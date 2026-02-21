package project.TimeManager;

import com.querydsl.jpa.impl.JPAQueryFactory;
import jakarta.persistence.EntityManager;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.data.domain.AuditorAware;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.Optional;
import java.util.UUID;

@SpringBootApplication
@EnableScheduling
public class TimeManagerApplication {

	public static void main(String[] args) {
		SpringApplication.run(TimeManagerApplication.class, args);
	}

	// 나중에 세션 정보나 스프링 시큐리티 로그인 정보에서 Id받게 바꾸기
	@Bean
	public AuditorAware<String> auditorProvider() {
		return () -> Optional.of(UUID.randomUUID().toString());
	}

	@Bean
	JPAQueryFactory jpaQueryFactory(EntityManager em) {
		return new JPAQueryFactory(em);
	}

}
