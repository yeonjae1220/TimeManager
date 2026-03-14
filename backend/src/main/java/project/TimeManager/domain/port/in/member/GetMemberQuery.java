package project.TimeManager.domain.port.in.member;

import project.TimeManager.domain.member.model.Member;

import java.util.Optional;

public interface GetMemberQuery {
    Optional<Member> getMember(Long memberId);
}
