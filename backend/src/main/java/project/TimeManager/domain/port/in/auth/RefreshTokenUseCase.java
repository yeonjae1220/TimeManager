package project.TimeManager.domain.port.in.auth;

import project.TimeManager.application.dto.command.auth.RefreshTokenCommand;
import project.TimeManager.application.dto.result.TokenPairResult;

public interface RefreshTokenUseCase {
    TokenPairResult refresh(RefreshTokenCommand command);
}
