package project.TimeManager.domain.port.in.auth;

import project.TimeManager.application.dto.command.auth.LogoutCommand;

public interface LogoutUseCase {
    void logout(LogoutCommand command);
}
