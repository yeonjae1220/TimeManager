package project.TimeManager.domain.port.out.auth;

import project.TimeManager.application.dto.result.GoogleUserProfile;

public interface GoogleOAuthPort {
    GoogleUserProfile getUserProfile(String authCode, String redirectUri);
}
