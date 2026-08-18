package project.TimeManager.application.service.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import project.TimeManager.domain.port.out.member.DailyResetTarget;
import project.TimeManager.domain.port.out.member.LoadDailyResetTargetsPort;

import java.time.Clock;
import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

/**
 * 매시 정각에 돌면서 "이 회원의 지난 리셋 경계가 아직 처리되지 않았는가"로 대상을 고른다.
 *
 * <p><b>시각 일치가 아니라 경계 비교인 이유.</b> 예전에는 {@code now.getHour() ==
 * dailyResetHour} 로 골랐다. 그러면 그 정각에 파드가 안 떠 있는 것만으로 그날치 리셋이
 * 통째로 사라졌다 — 한 시간 뒤에는 조건이 안 맞으니 재시도도 없었다. 배포·재시작이
 * 잦을수록 확률이 올라가는데, 유실은 로그에도 안 남았다(안 돈 배치는 아무것도 안 쓴다).
 * 지금은 회원마다 마지막으로 처리한 경계를 들고 있어 <b>몇 시에 돌든</b> 밀린 경계를
 * 따라잡는다. 다운타임이 며칠이어도 따라잡기는 가장 최근 경계 한 번으로 접힌다 —
 * 리셋은 "0으로 만드는" 멱등 연산이라 놓친 날짜만큼 반복할 이유가 없다.
 *
 * <p>이 클래스에는 {@code @Transactional} 이 없다 — 의도적이다. 실제 리셋은 회원 단위로
 * {@link MemberDailyResetter} 의 독립 트랜잭션에서 일어나고, 여기서는 실패를 <b>격리</b>해
 * 한 명이 막혀도 나머지가 리셋되게 한다. 실패한 회원은 경계가 표시되지 않으므로 다음
 * 실행이 자동으로 다시 시도한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DailyResetScheduler {

    /**
     * 이만큼 늦게 처리된 리셋은 "정시"가 아니라 "따라잡기"로 본다.
     *
     * <p>배치가 매시 정각이므로 정상 경로의 지연은 최대 1시간이다. 그보다 늦었다는 것은
     * 최소 한 번의 실행을 통째로 놓쳤다는 뜻이고, 그건 조용히 지나가면 안 되는 사건이다.
     */
    private static final Duration LATE_THRESHOLD = Duration.ofHours(1);

    private final LoadDailyResetTargetsPort loadDailyResetTargetsPort;
    private final MemberDailyResetter memberDailyResetter;
    private final Clock clock;

    @Scheduled(cron = "0 0 * * * *")
    public void resetDailyTimes() {
        List<DailyResetTarget> targets = loadDailyResetTargetsPort.loadDailyResetTargets();
        Instant now = clock.instant();
        int reset = 0;
        int caughtUp = 0;
        int failed = 0;

        for (DailyResetTarget target : targets) {
            Long memberId = target.memberId();
            try {
                ZoneId zone = ZoneId.of(target.timezone());
                Instant boundary = mostRecentBoundary(now.atZone(zone), target.dailyResetHour());
                if (isAlreadyHandled(target, boundary)) continue;

                memberDailyResetter.resetOne(memberId, boundary);
                reset++;

                if (Duration.between(boundary, now).compareTo(LATE_THRESHOLD) > 0) {
                    caughtUp++;
                    // CATCH-UP 은 알림 쿼리가 매칭하는 토큰이다(ASCII 로 둔다 — LogQL 필터에
                    // 한글이 들어가면 ConfigMap·escaping 단계마다 깨질 자리가 늘어난다).
                    log.warn("[Daily Reset] CATCH-UP memberId={} — 경계 {} 를 {} 늦게 따라잡았다."
                                    + " 그 시각에 배치가 돌지 않았다는 뜻이다",
                            memberId, boundary, Duration.between(boundary, now));
                } else {
                    log.info("[Daily Reset] memberId={}, timezone={}, resetHour={}, boundary={}",
                            memberId, target.timezone(), target.dailyResetHour(), boundary);
                }
            } catch (DateTimeException e) {
                // 회원 데이터의 timezone 문자열이 깨진 경우. 리셋 시각을 계산할 수 없으니
                // 이 회원은 건너뛴다 — 다른 회원의 리셋까지 막을 이유가 없다.
                failed++;
                log.error("[Daily Reset] Invalid timezone for memberId={}: {}",
                        memberId, target.timezone());
            } catch (Exception e) {
                // 이 회원만 롤백된다. 다음 회원은 새 트랜잭션에서 계속 진행한다.
                // 경계가 표시되지 않았으므로 다음 실행이 이 회원을 다시 시도한다.
                failed++;
                log.error("[Daily Reset] memberId={} FAILED — 다음 실행에서 재시도된다", memberId, e);
            }
        }

        // 요약은 조건 없이 남긴다. 대상이 0명인 시각이 훨씬 많은데(회원 대부분이 같은 시각에
        // 몰려 있다) 그때 아무 로그도 안 남기면 "대상이 없어 조용한 것"과 "스케줄러가 아예
        // 안 도는 것"(@EnableScheduling 누락·빈 미등록·구 이미지 배포)이 로그상 구분되지
        // 않는다. 매시 한 줄이면 그 둘이 갈라지고, 줄이 끊긴 것 자체가 장애 신호가 된다.
        if (failed > 0) {
            log.error("[Daily Reset] 회원 {}명 스캔, {}명 리셋(따라잡기 {}명), {}명 실패"
                            + " — 실패한 회원은 다음 실행에서 재시도된다",
                    targets.size(), reset, caughtUp, failed);
        } else {
            log.info("[Daily Reset] 회원 {}명 스캔, {}명 리셋(따라잡기 {}명), 실패 없음",
                    targets.size(), reset, caughtUp);
        }
    }

    /**
     * 가장 최근에 지나간 리셋 경계. 회원 타임존의 {@code dailyResetHour} 정각이며,
     * 아직 오늘 그 시각이 안 됐으면 어제의 같은 시각이다.
     *
     * <p>날짜 연산을 {@code ZonedDateTime} 위에서 하는 것이 중요하다 — DST 전환일에
     * "어제 05:00" 은 24시간 전이 아니라 23시간 또는 25시간 전이다.
     */
    private static Instant mostRecentBoundary(ZonedDateTime now, int dailyResetHour) {
        ZonedDateTime todayBoundary = now.toLocalDate()
                .atTime(dailyResetHour, 0)
                .atZone(now.getZone());
        return (now.isBefore(todayBoundary) ? todayBoundary.minusDays(1) : todayBoundary)
                .toInstant();
    }

    /**
     * 마커가 null 인 경우는 스키마상 없어야 하지만(NOT NULL), 있다면 "한 번도 처리한 적
     * 없음"으로 보고 리셋한다 — 놓치는 쪽보다 한 번 더 0으로 만드는 쪽이 안전하다.
     */
    private static boolean isAlreadyHandled(DailyResetTarget target, Instant boundary) {
        Instant last = target.lastResetBoundaryAt();
        return last != null && !last.isBefore(boundary);
    }
}
