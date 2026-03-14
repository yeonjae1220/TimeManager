package project.TimeManager.domain.port.out.member;

import project.TimeManager.domain.member.model.MemberId;

public interface InitializeMemberTagsPort {
    void initializeDefaultTags(MemberId memberId);
}
