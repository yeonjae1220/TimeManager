package project.TimeManager.domain.port.out.member;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import project.TimeManager.domain.member.model.Member;

import java.util.Optional;

public interface LoadMemberPort {
    Optional<Member> loadMember(Long memberId);
    Optional<Member> findMemberByEmail(String email);
    Page<Member> findAll(Pageable pageable);
    long count();
}
