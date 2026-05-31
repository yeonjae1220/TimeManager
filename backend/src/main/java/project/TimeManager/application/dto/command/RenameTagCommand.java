package project.TimeManager.application.dto.command;

public record RenameTagCommand(Long tagId, String newName, Long memberId) {}
