package project.TimeManager.application.dto.command.auth;

public record GoogleLoginCommand(String code, String redirectUri) {}
