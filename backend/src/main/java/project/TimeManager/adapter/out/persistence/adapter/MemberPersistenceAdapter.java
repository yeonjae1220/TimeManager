package project.TimeManager.adapter.out.persistence.adapter;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import project.TimeManager.adapter.out.persistence.entity.MemberJpaEntity;
import project.TimeManager.adapter.out.persistence.mapper.MemberMapper;
import project.TimeManager.adapter.out.persistence.repository.MemberJpaRepository;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.member.model.MemberCredentials;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.port.out.auth.LoadMemberCredentialsPort;
import project.TimeManager.domain.port.out.member.LoadMemberPort;
import project.TimeManager.domain.port.out.member.SaveMemberPort;

import java.util.Optional;

@Component
@RequiredArgsConstructor
public class MemberPersistenceAdapter implements LoadMemberPort, SaveMemberPort, LoadMemberCredentialsPort {

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

    @Override
    public Optional<MemberCredentials> findByEmail(String email) {
        return memberJpaRepository.findByEmail(email)
                .map(entity -> new MemberCredentials(
                        MemberId.of(entity.getId()),
                        entity.getPassword()
                ));
    }

    @Override
    public Optional<Member> findMemberByEmail(String email) {
        return memberJpaRepository.findByEmail(email)
                .map(memberMapper::toDomain);
    }

}
