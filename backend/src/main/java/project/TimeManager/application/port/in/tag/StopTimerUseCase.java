package project.TimeManager.application.port.in.tag;

import project.TimeManager.application.dto.command.StopTimerCommand;

public interface StopTimerUseCase {
    Long stopTimer(StopTimerCommand command);
}
