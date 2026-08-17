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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class MemberPersistenceAdapter implements LoadMemberPort, SaveMemberPort, LoadMemberCredentialsPort, UpdateMemberPort, DeleteMemberPort {

    /** member.email 컬럼 길이(기본 VARCHAR(255))와 같아야 한다. */
    private static final int MAX_EMAIL_LENGTH = 255;

    private final MemberJpaRepository memberJpaRepository;
    private final MemberMapper memberMapper;

    @Override
    public Optional<Member> loadMember(Long memberId) {
        return memberJpaRepository.findActiveById(memberId)
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
    public void updateMember(Long memberId, String newName, String newHashedPassword, String timezone, Integer dailyResetHour) {
        MemberJpaEntity entity = memberJpaRepository.findActiveById(memberId)
                .orElseThrow(() -> new DomainException("존재하지 않는 회원입니다"));
        if (newName != null && !newName.isBlank()) {
            entity.setName(newName);
        }
        if (newHashedPassword != null) {
            entity.setPassword(newHashedPassword);
        }
        if (timezone != null) {
            entity.setTimezone(timezone);
        }
        if (dailyResetHour != null) {
            entity.setDailyResetHour(dailyResetHour);
        }
        memberJpaRepository.save(entity);
    }

    @Override
    public boolean softDeleteMember(Long memberId) {
        MemberJpaEntity entity = memberJpaRepository.findActiveById(memberId).orElse(null);
        if (entity == null) return false;
        entity.setDeletedAt(LocalDateTime.now());
        entity.setEmail(sealEmail(entity.getId(), entity.getEmail()));
        memberJpaRepository.save(entity);
        return true;
    }

    /**
     * unique 슬롯을 비우되 원래 주소는 알아볼 수 있게 남긴다 — 유예 기간 동안
     * 문의가 오면 어느 계정인지 찾아야 한다. 컬럼 상한(255)을 넘지 않도록 자른다.
     */
    private String sealEmail(Long memberId, String email) {
        String sealed = "deleted+" + memberId + "+" + (email == null ? "" : email);
        return sealed.length() <= MAX_EMAIL_LENGTH ? sealed : sealed.substring(0, MAX_EMAIL_LENGTH);
    }

    @Override
    public List<Long> findPurgeableMemberIds(LocalDateTime deletedBefore) {
        return memberJpaRepository.findPurgeableIncludingDeleted(deletedBefore).stream()
                .map(MemberJpaEntity::getId)
                .collect(Collectors.toList());
    }

    @Override
    public void purgeMember(Long memberId) {
        memberJpaRepository.deleteById(memberId);
    }

    @Override
    public void updateMemberRole(Long memberId, project.TimeManager.domain.member.model.MemberRole role) {
        MemberJpaEntity entity = memberJpaRepository.findActiveById(memberId)
                .orElseThrow(() -> new DomainException("존재하지 않는 회원입니다"));
        entity.setRole(role);
        memberJpaRepository.save(entity);
    }

    @Override
    public Page<Member> findAll(Pageable pageable) {
        return memberJpaRepository.findAllActive(pageable).map(memberMapper::toDomain);
    }

    @Override
    public long count() {
        return memberJpaRepository.countActive();
    }

    @Override
    public List<Member> loadAllMembers() {
        return memberJpaRepository.findAllActive().stream()
                .map(memberMapper::toDomain)
                .collect(Collectors.toList());
    }

}
