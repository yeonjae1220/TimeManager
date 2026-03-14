package project.TimeManager.domain.port.in.member;

import project.TimeManager.application.dto.command.member.RegisterMemberCommand;
import project.TimeManager.domain.member.model.MemberId;

public interface RegisterMemberUseCase {
    MemberId register(RegisterMemberCommand command);
}
