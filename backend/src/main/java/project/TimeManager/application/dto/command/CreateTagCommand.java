package project.TimeManager.application.dto.command;

public record CreateTagCommand(String tagName, Long memberId, Long parentTagId) {}
