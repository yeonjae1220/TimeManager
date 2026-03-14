package project.TimeManager.application.service.query;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.port.in.member.GetMemberQuery;
import project.TimeManager.domain.port.out.member.LoadMemberPort;

import java.util.Optional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class MemberQueryService implements GetMemberQuery {

    private final LoadMemberPort loadMemberPort;

    @Override
    public Optional<Member> getMember(Long memberId) {
        return loadMemberPort.loadMember(memberId);
    }
}
