package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.port.in.member.DeleteMemberUseCase;
import project.TimeManager.domain.port.out.member.DeleteMemberPort;
import project.TimeManager.domain.port.out.member.LoadMemberPort;
import project.TimeManager.domain.port.out.notification.SavePushSubscriptionPort;
import project.TimeManager.domain.port.out.record.DeleteRecordsByMemberPort;

@Service
@Transactional
@RequiredArgsConstructor
public class DeleteMemberCommandService implements DeleteMemberUseCase {

    private final LoadMemberPort loadMemberPort;
    private final DeleteMemberPort deleteMemberPort;
    private final SavePushSubscriptionPort savePushSubscriptionPort;
    private final DeleteRecordsByMemberPort deleteRecordsByMemberPort;

    /**
     * 삭제 순서가 곧 정확성이다. 회원 → 태그는 JPA cascade 로 지워지지만
     * 태그 → 기록에는 cascade 가 없어(그래야 기록 단건 삭제가 태그를 건드리지 않는다)
     * 기록을 먼저 지우지 않으면 record.tag_id 외래키 제약으로 삭제 전체가 실패한다.
     * 한 트랜잭션이므로 중간에 실패하면 아무것도 지워지지 않는다.
     */
    @Override
    public void deleteMember(Long memberId) {
        loadMemberPort.loadMember(memberId)
                .orElseThrow(() -> new DomainException("존재하지 않는 회원입니다"));
        savePushSubscriptionPort.deleteByMemberId(memberId);
        deleteRecordsByMemberPort.deleteByMemberId(memberId);
        deleteMemberPort.deleteMember(memberId);
    }
}
