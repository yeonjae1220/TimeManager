package project.TimeManager.domain.port.out.member;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.member.model.OAuthProvider;

import java.util.List;
import java.util.Optional;

public interface LoadMemberPort {
    Optional<Member> loadMember(Long memberId);
    Optional<Member> findMemberByEmail(String email);
    /** 소셜 제공자의 고유 식별자(sub)로 찾는다. 이메일은 바뀌거나(Apple 릴레이) 가려질 수 있다. */
    Optional<Member> findMemberByProvider(OAuthProvider provider, String providerId);
    Page<Member> findAll(Pageable pageable);
    long count();
    List<Member> loadAllMembers();
}
