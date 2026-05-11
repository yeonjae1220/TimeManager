package project.TimeManager.application.service.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.port.out.member.LoadMemberPort;
import project.TimeManager.domain.port.out.tag.ResetTagDailyTimesPort;

import java.time.DateTimeException;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class DailyResetScheduler {

    private final ResetTagDailyTimesPort resetTagDailyTimesPort;
    private final LoadMemberPort loadMemberPort;

    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void resetDailyTimes() {
        List<Member> members = loadMemberPort.loadAllMembers();
        for (Member member : members) {
            try {
                ZoneId zone = ZoneId.of(member.getTimezone());
                int currentHour = ZonedDateTime.now(zone).getHour();
                if (currentHour == member.getDailyResetHour()) {
                    log.info("[Daily Reset] memberId={}, timezone={}, resetHour={}",
                            member.getId().value(), member.getTimezone(), member.getDailyResetHour());
                    resetTagDailyTimesPort.resetDailyTimesByMemberId(member.getId().value());
                }
            } catch (DateTimeException e) {
                log.error("[Daily Reset] Invalid timezone for memberId={}: {}",
                        member.getId().value(), member.getTimezone());
            }
        }
    }
}
