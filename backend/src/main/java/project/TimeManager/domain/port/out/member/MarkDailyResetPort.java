package project.TimeManager.domain.port.out.member;

import java.time.Instant;

public interface MarkDailyResetPort {

    /**
     * 이 회원의 {@code boundary} 경계를 처리 완료로 표시한다.
     *
     * <p>반드시 실제 리셋과 <b>같은 트랜잭션</b>에서 호출해야 한다. 리셋이 실패했는데
     * 표시만 남으면 그 경계는 영영 재시도되지 않는다.
     */
    void markDailyReset(Long memberId, Instant boundary);
}
