package project.TimeManager.application.service.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import project.TimeManager.domain.port.in.member.PurgeDeletedMembersUseCase;

/**
 * 유예가 끝난 탈퇴 계정을 물리적으로 지운다.
 *
 * 하루 한 번이면 충분하다 — 유예가 30일 단위라 실행 시각의 정밀도는 의미가 없고,
 * 자주 돌리면 아무것도 지울 게 없는 쿼리만 반복된다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MemberPurgeScheduler {

    private final PurgeDeletedMembersUseCase purgeDeletedMembersUseCase;

    @Scheduled(cron = "0 30 4 * * *")
    public void purgeExpiredMembers() {
        try {
            int purged = purgeDeletedMembersUseCase.purgeExpired();
            if (purged > 0) log.info("MemberPurgeScheduler: purged {} member(s)", purged);
        } catch (Exception e) {
            // 배치가 죽어도 다음 실행에서 다시 시도한다. 여기서 예외를 밖으로
            // 던지면 스케줄러 스레드가 멈춰 이후 실행이 통째로 사라진다.
            log.error("MemberPurgeScheduler: purge failed", e);
        }
    }
}
