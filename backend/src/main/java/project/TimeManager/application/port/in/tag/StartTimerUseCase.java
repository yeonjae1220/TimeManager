package project.TimeManager.application.port.in.tag;

import project.TimeManager.application.dto.command.StartTimerCommand;

public interface StartTimerUseCase {
    Long startTimer(StartTimerCommand command);
}
