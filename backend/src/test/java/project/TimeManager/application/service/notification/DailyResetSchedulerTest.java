package project.TimeManager.application.service.notification;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.port.out.member.LoadMemberPort;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.BDDMockito.willDoNothing;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;

/**
 * 이 스케줄러의 핵심 책임은 "리셋한다"가 아니라 <b>실패를 격리한다</b>이다.
 *
 * <p>대상 선정이 시각 일치라 놓친 리셋은 다음 실행에서 재시도되지 않는다 — 루프 전체가
 * 한 트랜잭션이던 시절에는 한 명의 실패가 그 시각 대상 전원의 오늘치를 날렸다.
 *
 * <p>고정 클럭을 주입하지 않는다. 대신 회원의 {@code dailyResetHour} 를 <b>지금 그 회원의
 * 타임존에서의 시각</b>으로 만들어 "대상"을, +1 시간으로 만들어 "비대상"을 표현한다.
 * 스케줄러가 보는 시계와 테스트가 보는 시계가 같으므로 자정 경계에서도 흔들리지 않는다.
 */
@ExtendWith(MockitoExtension.class)
class DailyResetSchedulerTest {

    private static final ZoneId ZONE = ZoneId.of("UTC");

    @Mock
    private LoadMemberPort loadMemberPort;

    @Mock
    private MemberDailyResetter memberDailyResetter;

    @InjectMocks
    private DailyResetScheduler scheduler;

    private static int hourNow() {
        return ZonedDateTime.now(ZONE).getHour();
    }

    /** 지금이 리셋 시각인 회원 — 이번 실행의 대상이다. */
    private static Member due(long id) {
        return member(id, "UTC", hourNow());
    }

    /** 리셋 시각이 한 시간 뒤인 회원 — 이번 실행에서는 건너뛰어야 한다. */
    private static Member notDue(long id) {
        return member(id, "UTC", (hourNow() + 1) % 24);
    }

    private static Member member(long id, String timezone, int resetHour) {
        return Member.reconstitute(new MemberId(id), "회원" + id, "m" + id + "@example.com",
                "hash", null, null, null, timezone, resetHour, LocalDateTime.now());
    }

    private void givenMembers(Member... members) {
        given(loadMemberPort.loadAllMembers()).willReturn(List.of(members));
    }

    @Test
    @DisplayName("한 회원의 리셋이 실패해도 나머지 회원은 계속 리셋된다")
    void oneFailureDoesNotBlockTheRest() {
        // Arrange — 2번 회원만 실패한다(예: 락 타임아웃, 데드락)
        givenMembers(due(1L), due(2L), due(3L));
        willDoNothing().given(memberDailyResetter).resetOne(1L);
        willThrow(new RuntimeException("lock timeout")).given(memberDailyResetter).resetOne(2L);
        willDoNothing().given(memberDailyResetter).resetOne(3L);

        // Act
        scheduler.resetDailyTimes();

        // Assert — 실패 뒤에도 루프가 계속됐다. 예전엔 여기서 통째로 롤백됐다.
        then(memberDailyResetter).should().resetOne(1L);
        then(memberDailyResetter).should().resetOne(3L);
    }

    @Test
    @DisplayName("리셋 실패가 스케줄러 밖으로 새어나가지 않는다")
    void failureDoesNotEscape() {
        givenMembers(due(1L));
        willThrow(new RuntimeException("boom")).given(memberDailyResetter).resetOne(1L);

        assertThatCode(() -> scheduler.resetDailyTimes()).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("timezone 이 깨진 회원 하나가 다른 회원의 리셋을 막지 않는다")
    void brokenTimezoneIsIsolated() {
        // Arrange — ZoneId.of 가 DateTimeException 을 던지는 값
        givenMembers(member(1L, "Not/AZone", hourNow()), due(2L));

        // Act
        scheduler.resetDailyTimes();

        // Assert
        then(memberDailyResetter).should(never()).resetOne(1L);
        then(memberDailyResetter).should().resetOne(2L);
    }

    @Test
    @DisplayName("리셋 시각이 아닌 회원은 건드리지 않는다")
    void skipsMembersWhoseHourHasNotCome() {
        givenMembers(notDue(1L), due(2L));

        scheduler.resetDailyTimes();

        then(memberDailyResetter).should(never()).resetOne(1L);
        then(memberDailyResetter).should().resetOne(2L);
    }

    @Test
    @DisplayName("대상이 없으면 아무 것도 호출하지 않는다")
    void noMembersDueIsANoOp() {
        givenMembers(notDue(1L), notDue(2L));

        scheduler.resetDailyTimes();

        then(memberDailyResetter).shouldHaveNoInteractions();
    }
}
