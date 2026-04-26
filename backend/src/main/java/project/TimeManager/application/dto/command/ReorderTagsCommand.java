package project.TimeManager.application.dto.command;

import java.util.List;

public record ReorderTagsCommand(Long parentTagId, List<Long> orderedTagIds, Long memberId) {}
