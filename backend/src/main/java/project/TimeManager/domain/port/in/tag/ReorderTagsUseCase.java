package project.TimeManager.domain.port.in.tag;

import project.TimeManager.application.dto.command.ReorderTagsCommand;

public interface ReorderTagsUseCase {
    void reorderTags(ReorderTagsCommand command);
}
