package project.TimeManager.application.service.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.port.out.member.LoadMemberPort;

import java.time.DateTimeException;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

/**
 * 매시 정각에 돌면서 "지금이 그 회원의 리셋 시각인가"로 대상을 고른다.
 *
 * <p>이 클래스에는 {@code @Transactional} 이 없다 — 의도적이다. 실제 리셋은 회원 단위로
 * {@link MemberDailyResetter} 의 독립 트랜잭션에서 일어나고, 여기서는 실패를 <b>격리</b>해
 * 한 명이 막혀도 나머지가 리셋되게 한다.
 *
 * <p>격리가 특히 중요한 배치다. 대상 선정이 <b>시각 일치</b>(now.getHour() == dailyResetHour)라
 * 한 번 놓친 리셋은 다음 실행에서 재시도되지 않는다 — 한 시간 뒤에는 조건이 안 맞기 때문에
 * 그날치가 통째로 사라진다. 게다가 대부분의 회원이 기본값(5시)을 그대로 쓰므로 한 시각에
 * 몰려 있어, 루프 전체가 한 트랜잭션이면 한 명의 실패가 사실상 전 회원의 그날 리셋을 날린다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DailyResetScheduler {

    private final LoadMemberPort loadMemberPort;
    private final MemberDailyResetter memberDailyResetter;

    @Scheduled(cron = "0 0 * * * *")
    public void resetDailyTimes() {
        List<Member> members = loadMemberPort.loadAllMembers();
        int reset = 0;
        int failed = 0;

        for (Member member : members) {
            Long memberId = member.getId().value();
            try {
                ZoneId zone = ZoneId.of(member.getTimezone());
                if (ZonedDateTime.now(zone).getHour() != member.getDailyResetHour()) continue;

                memberDailyResetter.resetOne(memberId);
                reset++;
                log.info("[Daily Reset] memberId={}, timezone={}, resetHour={}",
                        memberId, member.getTimezone(), member.getDailyResetHour());
            } catch (DateTimeException e) {
                // 회원 데이터의 timezone 문자열이 깨진 경우. 리셋 시각을 계산할 수 없으니
                // 이 회원은 건너뛴다 — 다른 회원의 리셋까지 막을 이유가 없다.
                failed++;
                log.error("[Daily Reset] Invalid timezone for memberId={}: {}",
                        memberId, member.getTimezone());
            } catch (Exception e) {
                // 이 회원만 롤백된다. 다음 회원은 새 트랜잭션에서 계속 진행한다.
                // 단, 이 회원의 오늘치 리셋은 사라진다(한 시간 뒤엔 시각이 안 맞는다) —
                // 그래서 실패는 반드시 눈에 띄어야 하고, 대상 전원을 함께 날려선 안 된다.
                failed++;
                log.error("[Daily Reset] memberId={} FAILED — 오늘치 리셋은 재시도되지 않는다", memberId, e);
            }
        }

        if (failed > 0) {
            log.error("[Daily Reset] {} 명 리셋, {} 명 실패 — 실패한 회원의 오늘 일일 누적은 어제 값이 남는다",
                    reset, failed);
        }
    }
}
