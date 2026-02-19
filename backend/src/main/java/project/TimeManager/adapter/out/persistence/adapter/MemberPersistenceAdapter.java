package project.TimeManager.adapter.out.persistence.adapter;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import project.TimeManager.adapter.out.persistence.entity.MemberJpaEntity;
import project.TimeManager.adapter.out.persistence.mapper.MemberMapper;
import project.TimeManager.adapter.out.persistence.repository.MemberJpaRepository;
import project.TimeManager.application.port.out.member.LoadMemberPort;
import project.TimeManager.application.port.out.member.SaveMemberPort;
import project.TimeManager.domain.member.model.Member;

import java.util.Optional;

@Component
@RequiredArgsConstructor
public class MemberPersistenceAdapter implements LoadMemberPort, SaveMemberPort {

    private final MemberJpaRepository memberJpaRepository;
    private final MemberMapper memberMapper;

    @Override
    public Optional<Member> loadMember(Long memberId) {
        return memberJpaRepository.findById(memberId)
                .map(memberMapper::toDomain);
    }

    @Override
    public Long saveMember(Member member) {
        MemberJpaEntity entity = memberMapper.toNewJpaEntity(member);
        return memberJpaRepository.save(entity).getId();
    }

    public MemberJpaEntity loadJpaEntity(Long memberId) {
        return memberJpaRepository.findById(memberId)
                .orElseThrow(() -> new EntityNotFoundException("Member not found: " + memberId));
    }
}
