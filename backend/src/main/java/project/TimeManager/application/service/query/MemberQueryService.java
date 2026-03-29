package project.TimeManager.application.service.query;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.application.dto.result.MemberProfileResult;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.port.in.member.GetMemberProfileUseCase;
import project.TimeManager.domain.port.in.member.GetMemberQuery;
import project.TimeManager.domain.port.out.member.LoadMemberPort;

import java.util.Optional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class MemberQueryService implements GetMemberQuery, GetMemberProfileUseCase {

    private final LoadMemberPort loadMemberPort;

    @Override
    public Optional<Member> getMember(Long memberId) {
        return loadMemberPort.loadMember(memberId);
    }

    @Override
    public MemberProfileResult getProfile(Long memberId) {
        Member member = loadMemberPort.loadMember(memberId)
                .orElseThrow(() -> new DomainException("존재하지 않는 회원입니다"));
        return new MemberProfileResult(
                member.getId().value(),
                member.getName(),
                member.getEmail(),
                member.getProvider().name()
        );
    }
}
