package project.TimeManager.application.port.in.tag;

import project.TimeManager.application.dto.command.CreateTagCommand;

public interface CreateTagUseCase {
    Long createTag(CreateTagCommand command);
}
