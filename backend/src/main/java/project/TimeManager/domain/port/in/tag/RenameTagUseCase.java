package project.TimeManager.domain.port.in.tag;

import project.TimeManager.application.dto.command.RenameTagCommand;

public interface RenameTagUseCase {
    Long renameTag(RenameTagCommand command);
}
