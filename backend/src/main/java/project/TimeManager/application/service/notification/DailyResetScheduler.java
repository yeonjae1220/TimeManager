package project.TimeManager.application.service.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.adapter.out.persistence.repository.TagJpaRepository;

@Slf4j
@Component
@RequiredArgsConstructor
public class DailyResetScheduler {

    private final TagJpaRepository tagJpaRepository;

    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void resetDailyTimes() {
        log.info("[Daily Reset] 일일 시간 초기화 시작");
        tagJpaRepository.resetAllDailyTimes();
        log.info("[Daily Reset] 일일 시간 초기화 완료");
    }
}
