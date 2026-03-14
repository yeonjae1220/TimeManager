package project.TimeManager.domain.port.in.auth;

import project.TimeManager.application.dto.command.auth.LoginCommand;
import project.TimeManager.application.dto.result.TokenPairResult;

public interface LoginUseCase {
    TokenPairResult login(LoginCommand command);
}
