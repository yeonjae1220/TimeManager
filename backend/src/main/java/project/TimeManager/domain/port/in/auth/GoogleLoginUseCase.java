package project.TimeManager.domain.port.in.auth;

import project.TimeManager.application.dto.command.auth.GoogleLoginCommand;
import project.TimeManager.application.dto.result.GoogleLoginResult;

public interface GoogleLoginUseCase {
    GoogleLoginResult loginWithGoogle(GoogleLoginCommand command);
}
