package project.TimeManager.application.port.in.tag;

import project.TimeManager.application.dto.command.ResetTimerCommand;

public interface ResetTimerUseCase {
    Long resetTimer(ResetTimerCommand command);
}
