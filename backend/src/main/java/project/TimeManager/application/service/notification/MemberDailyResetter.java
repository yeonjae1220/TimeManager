package project.TimeManager.application.service.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.domain.port.out.tag.ResetTagDailyTimesPort;

/**
 * 회원 한 명의 일일 시간 리셋을 <b>독립 트랜잭션</b>으로 수행한다.
 *
 * <p>별도 빈으로 분리한 이유는 트랜잭션 경계 때문이다. 같은 클래스 안의 메서드를 호출하면
 * 프록시를 거치지 않아 {@code @Transactional} 이 걸리지 않으므로, 배치 루프와 회원 단위
 * 작업은 서로 다른 빈에 있어야 한다.
 *
 * <p>여기서 트랜잭션이 필요한 것은 선택이 아니다 — 리셋은 {@code @Modifying} 벌크 UPDATE 라
 * 트랜잭션 밖에서 실행하면 {@code TransactionRequiredException} 으로 실패한다. 스케줄러
 * 메서드에 걸려 있던 {@code @Transactional} 을 걷어낸 자리를 이 경계가 대신한다.
 *
 * <p>경계를 회원 단위로 내리는 것이 곧 정확성이다 — 루프 전체가 한 트랜잭션이면 한 명의
 * 리셋 실패가 그 시각 대상 <b>전원</b>을 롤백시킨다. 게다가 이 배치는 매시 정각에 돌면서
 * "지금이 그 회원의 리셋 시각인가"로 대상을 고르므로, 롤백된 리셋은 <b>다음 실행에서
 * 재시도되지 않고 그날치가 통째로 사라진다</b>(한 시간 뒤에는 조건이 안 맞는다).
 *
 * @see MemberPurgeScheduler purge 는 다음 날 재시도되지만 이쪽은 그렇지 않다
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MemberDailyResetter {

    private final ResetTagDailyTimesPort resetTagDailyTimesPort;

    @Transactional
    public void resetOne(Long memberId) {
        resetTagDailyTimesPort.resetDailyTimesByMemberId(memberId);
    }
}
