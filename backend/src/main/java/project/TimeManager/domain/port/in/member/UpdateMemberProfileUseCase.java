package project.TimeManager.domain.port.in.member;

import project.TimeManager.application.dto.command.member.UpdateMemberProfileCommand;
import project.TimeManager.application.dto.result.MemberProfileResult;

public interface UpdateMemberProfileUseCase {
    MemberProfileResult updateProfile(UpdateMemberProfileCommand command);
}
