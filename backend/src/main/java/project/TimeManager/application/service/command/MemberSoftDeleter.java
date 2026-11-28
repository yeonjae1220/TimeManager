package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.domain.port.out.member.DeleteMemberPort;
import project.TimeManager.domain.port.out.notification.SavePushSubscriptionPort;

/**
 * 계정 삭제의 DB 구간(소프트 삭제 + 알림 구독 제거)을 한 트랜잭션으로 묶는다. 별도 빈인 이유는
 * {@link DeleteMemberCommandService} 가 Apple 철회(HTTP)를 트랜잭션 밖에서 하기 때문이다.
 */
@Component
@RequiredArgsConstructor
public class MemberSoftDeleter {

    private final DeleteMemberPort deleteMemberPort;
    private final SavePushSubscriptionPort savePushSubscriptionPort;

    /** @return 이번 호출로 삭제됐으면 true, 없거나 이미 삭제된 계정이면 false */
    @Transactional
    public boolean softDelete(Long memberId) {
        if (!deleteMemberPort.softDeleteMember(memberId)) return false;
        savePushSubscriptionPort.deleteByMemberId(memberId);
        return true;
    }
}
