package project.TimeManager.domain.port.in.tag;

import project.TimeManager.application.dto.command.SetDailyGoalCommand;

public interface SetDailyGoalUseCase {
    Long setDailyGoal(SetDailyGoalCommand command);
}
