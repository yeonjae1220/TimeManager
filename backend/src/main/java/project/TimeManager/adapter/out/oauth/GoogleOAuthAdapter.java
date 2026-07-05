package project.TimeManager.adapter.out.oauth;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import project.TimeManager.application.dto.result.GoogleUserProfile;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.port.out.auth.GoogleOAuthPort;

@Component
public class GoogleOAuthAdapter implements GoogleOAuthPort {

    private final RestClient restClient;

    @Value("${google.oauth2.client-id:}")
    private String clientId;

    @Value("${google.oauth2.client-secret:}")
    private String clientSecret;

    @Value("${google.oauth2.token-uri:https://oauth2.googleapis.com/token}")
    private String tokenUri;

    @Value("${google.oauth2.userinfo-uri:https://www.googleapis.com/oauth2/v3/userinfo}")
    private String userinfoUri;

    public GoogleOAuthAdapter() {
        this.restClient = RestClient.create();
    }

    @Override
    public GoogleUserProfile getUserProfile(String authCode, String redirectUri) {
        try {
            GoogleTokenResponse tokenResponse = exchangeAuthCode(authCode, redirectUri);
            GoogleUserInfoResponse userInfo = fetchUserInfo(tokenResponse.accessToken());
            return new GoogleUserProfile(userInfo.email(), userInfo.name(), userInfo.picture(), userInfo.sub());
        } catch (RestClientResponseException e) {
            throw new DomainException("Google 인증에 실패했습니다. 코드를 확인해 주세요");
        }
    }

    private GoogleTokenResponse exchangeAuthCode(String authCode, String redirectUri) {
        // MultiValueMap + FormHttpMessageConverter로 각 값을 x-www-form-urlencoded 규칙에 맞게 인코딩한다.
        // 원시 문자열 연결은 code/redirectUri에 '&','=' 등이 섞이면 body가 깨지거나 파라미터가 주입될 수 있다.
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("code", authCode);
        body.add("client_id", clientId);
        body.add("client_secret", clientSecret);
        body.add("redirect_uri", redirectUri);
        body.add("grant_type", "authorization_code");

        return restClient.post()
                .uri(tokenUri)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(body)
                .retrieve()
                .body(GoogleTokenResponse.class);
    }

    private GoogleUserInfoResponse fetchUserInfo(String accessToken) {
        return restClient.get()
                .uri(userinfoUri)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                .retrieve()
                .body(GoogleUserInfoResponse.class);
    }

    private record GoogleTokenResponse(
            @JsonProperty("access_token") String accessToken,
            @JsonProperty("token_type") String tokenType
    ) {}

    private record GoogleUserInfoResponse(
            String email,
            String name,
            String picture,
            String sub
    ) {}
}
