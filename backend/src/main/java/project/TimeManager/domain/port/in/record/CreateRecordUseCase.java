package project.TimeManager.domain.port.in.record;

import project.TimeManager.application.dto.command.CreateRecordCommand;

public interface CreateRecordUseCase {
    Long createRecord(CreateRecordCommand command);
}
