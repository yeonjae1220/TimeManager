package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.port.in.member.DeleteMemberUseCase;
import project.TimeManager.domain.port.out.member.DeleteMemberPort;
import project.TimeManager.domain.port.out.member.LoadMemberPort;

@Service
@Transactional
@RequiredArgsConstructor
public class DeleteMemberCommandService implements DeleteMemberUseCase {

    private final LoadMemberPort loadMemberPort;
    private final DeleteMemberPort deleteMemberPort;

    @Override
    public void deleteMember(Long memberId) {
        loadMemberPort.loadMember(memberId)
                .orElseThrow(() -> new DomainException("존재하지 않는 회원입니다"));
        deleteMemberPort.deleteMember(memberId);
    }
}
