package project.TimeManager.domain.port.in.record;

import project.TimeManager.application.dto.command.EditRecordTimeCommand;

public interface EditRecordTimeUseCase {
    Long editRecordTime(EditRecordTimeCommand command);
}
