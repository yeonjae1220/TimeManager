package project.TimeManager.application.port.out.member;

import project.TimeManager.domain.member.model.Member;

import java.util.Optional;

public interface LoadMemberPort {
    Optional<Member> loadMember(Long memberId);
}
