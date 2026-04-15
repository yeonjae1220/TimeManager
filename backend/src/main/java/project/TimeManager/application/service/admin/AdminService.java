package project.TimeManager.application.service.admin;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.member.model.MemberRole;
import project.TimeManager.domain.port.out.member.LoadMemberPort;
import project.TimeManager.domain.port.out.member.UpdateMemberPort;

@Service
@Transactional
@RequiredArgsConstructor
public class AdminService {

    private final LoadMemberPort loadMemberPort;
    private final UpdateMemberPort updateMemberPort;

    @Transactional(readOnly = true)
    public Page<Member> getMembers(Pageable pageable) {
        return loadMemberPort.findAll(pageable);
    }

    public void updateMemberRole(Long memberId, MemberRole role) {
        updateMemberPort.updateMemberRole(memberId, role);
    }

    @Transactional(readOnly = true)
    public long getTotalMemberCount() {
        return loadMemberPort.count();
    }
}
