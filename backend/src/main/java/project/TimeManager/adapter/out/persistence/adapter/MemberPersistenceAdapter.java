package project.TimeManager.adapter.out.persistence.adapter;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;
import project.TimeManager.adapter.out.persistence.entity.MemberJpaEntity;
import project.TimeManager.adapter.out.persistence.mapper.MemberMapper;
import project.TimeManager.adapter.out.persistence.repository.MemberJpaRepository;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.member.model.MemberCredentials;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.port.out.auth.LoadMemberCredentialsPort;
import project.TimeManager.domain.port.out.member.DeleteMemberPort;
import project.TimeManager.domain.port.out.member.LoadMemberPort;
import project.TimeManager.domain.port.out.member.SaveMemberPort;
import project.TimeManager.domain.port.out.member.UpdateMemberPort;
import project.TimeManager.domain.exception.DomainException;

import java.util.Optional;

@Component
@RequiredArgsConstructor
public class MemberPersistenceAdapter implements LoadMemberPort, SaveMemberPort, LoadMemberCredentialsPort, UpdateMemberPort, DeleteMemberPort {

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
                        entity.getPassword(),
                        entity.getRole()
                ));
    }

    @Override
    public Optional<Member> findMemberByEmail(String email) {
        return memberJpaRepository.findByEmail(email)
                .map(memberMapper::toDomain);
    }

    @Override
    public void updateMember(Long memberId, String newName, String newHashedPassword) {
        MemberJpaEntity entity = memberJpaRepository.findById(memberId)
                .orElseThrow(() -> new DomainException("존재하지 않는 회원입니다"));
        if (newName != null && !newName.isBlank()) {
            entity.setName(newName);
        }
        if (newHashedPassword != null) {
            entity.setPassword(newHashedPassword);
        }
        memberJpaRepository.save(entity);
    }

    @Override
    public void deleteMember(Long memberId) {
        memberJpaRepository.deleteById(memberId);
    }

    @Override
    public void updateMemberRole(Long memberId, project.TimeManager.domain.member.model.MemberRole role) {
        MemberJpaEntity entity = memberJpaRepository.findById(memberId)
                .orElseThrow(() -> new DomainException("존재하지 않는 회원입니다"));
        entity.setRole(role);
        memberJpaRepository.save(entity);
    }

    @Override
    public Page<Member> findAll(Pageable pageable) {
        return memberJpaRepository.findAll(pageable).map(memberMapper::toDomain);
    }

    @Override
    public long count() {
        return memberJpaRepository.count();
    }

}
