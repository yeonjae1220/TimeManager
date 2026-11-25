package project.TimeManager.domain.port.in.auth;

import project.TimeManager.application.dto.command.auth.AppleLoginCommand;
import project.TimeManager.application.dto.result.SocialLoginResult;

public interface AppleLoginUseCase {
    SocialLoginResult loginWithApple(AppleLoginCommand command);
}
