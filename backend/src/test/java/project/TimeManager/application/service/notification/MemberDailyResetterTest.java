package project.TimeManager.application.service.notification;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import project.TimeManager.domain.port.out.member.MarkDailyResetPort;
import project.TimeManager.domain.port.out.tag.ResetTagDailyTimesPort;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.then;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.inOrder;

/**
 * 리셋과 "처리 완료 표시"는 반드시 <b>같은 트랜잭션</b>에서 함께 일어나야 한다.
 *
 * <p>표시만 남고 리셋이 안 되면 그 경계는 영영 재시도되지 않고(따라잡기 로직이 이미
 * 처리한 것으로 본다), 반대로 리셋만 되고 표시가 안 되면 다음 시각에 또 리셋된다.
 * 전자가 훨씬 나쁘다 — 조용히 그날치를 잃는다.
 */
@ExtendWith(MockitoExtension.class)
class MemberDailyResetterTest {

    private static final Instant BOUNDARY = Instant.parse("2026-08-18T20:00:00Z");

    @Mock
    private ResetTagDailyTimesPort resetTagDailyTimesPort;

    @Mock
    private MarkDailyResetPort markDailyResetPort;

    @InjectMocks
    private MemberDailyResetter resetter;

    @Test
    @DisplayName("리셋한 뒤 그 경계를 처리 완료로 표시한다")
    void resetsThenMarksTheBoundary() {
        resetter.resetOne(1L, BOUNDARY);

        InOrder order = inOrder(resetTagDailyTimesPort, markDailyResetPort);
        order.verify(resetTagDailyTimesPort).resetDailyTimesByMemberId(1L);
        order.verify(markDailyResetPort).markDailyReset(1L, BOUNDARY);
    }

    @Test
    @DisplayName("리셋이 실패하면 경계를 표시하지 않는다 — 다음 실행이 다시 시도해야 한다")
    void doesNotMarkTheBoundaryWhenResetFails() {
        willThrow(new RuntimeException("lock timeout"))
                .given(resetTagDailyTimesPort).resetDailyTimesByMemberId(1L);

        assertThatThrownBy(() -> resetter.resetOne(1L, BOUNDARY))
                .isInstanceOf(RuntimeException.class);

        then(markDailyResetPort).shouldHaveNoInteractions();
    }
}
