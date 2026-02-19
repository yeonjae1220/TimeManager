package project.TimeManager.application.port.in.tag;

import project.TimeManager.application.dto.command.MoveTagCommand;

public interface MoveTagUseCase {
    Long moveTag(MoveTagCommand command);
}
