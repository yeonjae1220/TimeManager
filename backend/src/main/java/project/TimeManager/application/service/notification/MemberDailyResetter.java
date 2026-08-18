package project.TimeManager.application.service.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.domain.port.out.member.MarkDailyResetPort;
import project.TimeManager.domain.port.out.tag.ResetTagDailyTimesPort;

import java.time.Instant;

/**
 * 회원 한 명의 일일 시간 리셋을 <b>독립 트랜잭션</b>으로 수행한다.
 *
 * <p>별도 빈으로 분리한 이유는 트랜잭션 경계 때문이다. 같은 클래스 안의 메서드를 호출하면
 * 프록시를 거치지 않아 {@code @Transactional} 이 걸리지 않으므로, 배치 루프와 회원 단위
 * 작업은 서로 다른 빈에 있어야 한다.
 *
 * <p>여기서 트랜잭션이 필요한 것은 선택이 아니다 — 리셋은 {@code @Modifying} 벌크 UPDATE 라
 * 트랜잭션 밖에서 실행하면 {@code TransactionRequiredException} 으로 실패한다.
 *
 * <p>경계 표시가 같은 트랜잭션에 있는 것도 선택이 아니다. 표시만 커밋되고 리셋이 롤백되면
 * {@link DailyResetScheduler} 의 따라잡기 로직이 그 경계를 이미 처리한 것으로 보아
 * <b>영영 재시도하지 않는다</b> — 그날치를 조용히 잃는 유일한 경로다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MemberDailyResetter {

    private final ResetTagDailyTimesPort resetTagDailyTimesPort;
    private final MarkDailyResetPort markDailyResetPort;

    @Transactional
    public void resetOne(Long memberId, Instant boundary) {
        resetTagDailyTimesPort.resetDailyTimesByMemberId(memberId);
        markDailyResetPort.markDailyReset(memberId, boundary);
    }
}
