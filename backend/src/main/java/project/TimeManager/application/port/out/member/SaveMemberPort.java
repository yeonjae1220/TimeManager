package project.TimeManager.application.port.out.member;

import project.TimeManager.domain.member.model.Member;

public interface SaveMemberPort {
    Long saveMember(Member member);
}
