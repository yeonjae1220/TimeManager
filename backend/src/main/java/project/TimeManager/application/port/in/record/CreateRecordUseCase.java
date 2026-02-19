package project.TimeManager.application.port.in.record;

import project.TimeManager.application.dto.command.CreateRecordCommand;

public interface CreateRecordUseCase {
    Long createRecord(CreateRecordCommand command);
}
