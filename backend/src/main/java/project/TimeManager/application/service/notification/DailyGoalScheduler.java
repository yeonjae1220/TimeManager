package project.TimeManager.application.service.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DailyGoalScheduler {

    private final PushSender pushSender;

    // @Scheduled(cron = "0 0 * * * *") // TODO: 구현 완료 후 활성화
    public void checkDailyGoals() {
        log.info("[Push] 일일 목표 달성 여부 확인 스케줄러 - 미구현, 비활성화 상태");
        // TODO: TagService를 주입받아 오늘 목표를 달성한 (memberId, tagName) 목록을 조회하고
        //       pushSender.sendToMember(memberId, "목표 달성!", tagName + " 일일 목표를 달성했습니다.") 호출
    }
}
