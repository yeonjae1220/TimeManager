package project.TimeManager.application.service.command;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import project.TimeManager.domain.port.out.member.DeleteMemberPort;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.BDDMockito.willDoNothing;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.times;

/**
 * 이 서비스의 핵심 책임은 "지운다"가 아니라 <b>실패를 격리한다</b>이다.
 * 삭제 자체의 정확성(순서·외래키)은 {@link DeleteMemberIntegrationTest} 가 실제 DB 로 검증한다.
 */
@ExtendWith(MockitoExtension.class)
class PurgeDeletedMembersCommandServiceTest {

    @Mock
    private DeleteMemberPort deleteMemberPort;

    @Mock
    private MemberPurger memberPurger;

    private PurgeDeletedMembersCommandService service;

    private void givenPurgeable(Long... ids) {
        service = new PurgeDeletedMembersCommandService(deleteMemberPort, memberPurger, 30);
        given(deleteMemberPort.findPurgeableMemberIds(any(LocalDateTime.class)))
                .willReturn(List.of(ids));
    }

    @Test
    @DisplayName("한 회원의 삭제가 실패해도 나머지 회원은 계속 지워진다")
    void oneFailureDoesNotBlockTheRest() {
        // Arrange — 2번 회원만 실패한다(예: 나중에 추가된 자식 테이블의 외래키, 락 타임아웃)
        givenPurgeable(1L, 2L, 3L);
        willDoNothing().given(memberPurger).purgeOne(1L);
        willThrow(new RuntimeException("FK violation")).given(memberPurger).purgeOne(2L);
        willDoNothing().given(memberPurger).purgeOne(3L);

        // Act
        int purged = service.purgeExpired();

        // Assert — 실패 뒤에도 루프가 계속돼 3번이 지워졌다. 루프 전체가 한 트랜잭션이었다면
        // 2번의 실패가 1번까지 롤백시키고 3번은 시도조차 되지 않았을 것이다.
        assertThat(purged).isEqualTo(2);
        then(memberPurger).should().purgeOne(1L);
        then(memberPurger).should().purgeOne(3L);
    }

    @Test
    @DisplayName("실패가 배치 밖으로 전파되지 않아 스케줄러가 죽지 않는다")
    void failureDoesNotEscape() {
        givenPurgeable(1L);
        willThrow(new RuntimeException("boom")).given(memberPurger).purgeOne(1L);

        assertThatCode(() -> service.purgeExpired()).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("전원 실패해도 0을 반환할 뿐 예외는 없다")
    void allFailuresReturnZero() {
        givenPurgeable(1L, 2L);
        willThrow(new RuntimeException("boom")).given(memberPurger).purgeOne(any());

        assertThat(service.purgeExpired()).isZero();
        then(memberPurger).should(times(2)).purgeOne(any());
    }

    @Test
    @DisplayName("대상이 없으면 회원 단위 작업을 아예 호출하지 않는다")
    void noTargetsSkipsWork() {
        service = new PurgeDeletedMembersCommandService(deleteMemberPort, memberPurger, 30);
        given(deleteMemberPort.findPurgeableMemberIds(any(LocalDateTime.class)))
                .willReturn(List.of());

        assertThat(service.purgeExpired()).isZero();
        then(memberPurger).shouldHaveNoInteractions();
    }

    @Test
    @DisplayName("유예 기간이 임계 시각으로 반영된다")
    void graceDaysBecomeThreshold() {
        service = new PurgeDeletedMembersCommandService(deleteMemberPort, memberPurger, 7);
        given(deleteMemberPort.findPurgeableMemberIds(any(LocalDateTime.class)))
                .willReturn(List.of());
        LocalDateTime before = LocalDateTime.now().minusDays(7);

        service.purgeExpired();

        then(deleteMemberPort).should().findPurgeableMemberIds(
                org.mockito.ArgumentMatchers.argThat(threshold ->
                        !threshold.isBefore(before.minusMinutes(1))
                                && !threshold.isAfter(LocalDateTime.now().minusDays(7).plusMinutes(1))));
    }
}
