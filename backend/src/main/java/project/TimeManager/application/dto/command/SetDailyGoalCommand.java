package project.TimeManager.application.dto.command;

public record SetDailyGoalCommand(Long tagId, Long dailyGoalTime, Long memberId) {}
