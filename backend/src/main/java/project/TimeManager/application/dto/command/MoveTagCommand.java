package project.TimeManager.application.dto.command;

public record MoveTagCommand(Long tagId, Long newParentTagId) {}
