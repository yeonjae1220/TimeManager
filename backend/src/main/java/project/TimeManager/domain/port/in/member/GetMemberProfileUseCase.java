package project.TimeManager.domain.port.in.member;

import project.TimeManager.application.dto.result.MemberProfileResult;

public interface GetMemberProfileUseCase {
    MemberProfileResult getProfile(Long memberId);
}
