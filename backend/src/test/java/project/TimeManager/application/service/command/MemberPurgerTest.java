package project.TimeManager.application.service.command;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import project.TimeManager.domain.port.out.member.DeleteMemberPort;
import project.TimeManager.domain.port.out.notification.SavePushSubscriptionPort;
import project.TimeManager.domain.port.out.record.DeleteRecordsByMemberPort;

import static org.mockito.BDDMockito.inOrder;
import static org.mockito.BDDMockito.then;

/**
 * 물리 삭제의 <b>순서와 범위</b>를 고정한다.
 *
 * <p>순서(기록 → 회원)가 깨지면 외래키 제약으로 삭제 전체가 실패하고, 범위(푸시 구독)가
 * 빠지면 DB 가 막아주지 않아 고아 행이 조용히 남는다. 둘 다 실제 DB 없이는 확인할 수
 * 없어 보이지만, 호출 순서와 대상은 여기서 고정해두는 편이 회귀를 훨씬 빨리 잡는다 —
 * 실제 커밋까지 가는 검증은 {@link DeleteMemberIntegrationTest} 가 맡는다.
 */
@ExtendWith(MockitoExtension.class)
class MemberPurgerTest {

    @Mock
    private DeleteMemberPort deleteMemberPort;

    @Mock
    private DeleteRecordsByMemberPort deleteRecordsByMemberPort;

    @Mock
    private SavePushSubscriptionPort savePushSubscriptionPort;

    @InjectMocks
    private MemberPurger purger;

    @Test
    @DisplayName("기록을 먼저 지우고 회원을 마지막에 지운다")
    void deletesRecordsBeforeMember() {
        purger.purgeOne(7L);

        // 회원(→태그 cascade)을 먼저 지우면 record.tag_id 외래키에 걸려 전부 롤백된다.
        InOrder order = inOrder(deleteRecordsByMemberPort, deleteMemberPort);
        order.verify(deleteRecordsByMemberPort).deleteByMemberId(7L);
        order.verify(deleteMemberPort).purgeMember(7L);
    }

    @Test
    @DisplayName("푸시 구독도 함께 지운다 — 외래키가 없어 DB 가 막아주지 않는다")
    void deletesPushSubscriptions() {
        purger.purgeOne(7L);

        then(savePushSubscriptionPort).should().deleteByMemberId(7L);
    }
}
