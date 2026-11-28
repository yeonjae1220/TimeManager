package project.TimeManager.adapter.in.web.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * @param fullName Apple 이 최초 승인 때만 앱에 주는 이름. 이후 로그인에선 비어 온다.
 * @param authorizationCode 계정 삭제 시 Apple 토큰 철회(가이드라인 5.1.1(v))를 위해 앱이 넘기는 1회용 코드.
 *                          서버가 Apple refresh token 으로 바꿔 암호화해 둔다(AppleTokenLifecycle). 없어도 로그인은 된다.
 */
public record AppleLoginRequest(
        @NotBlank @Size(max = 4096) String identityToken,
        @Size(max = 1024) String authorizationCode,
        @NotBlank @Size(max = 128) String nonce,
        @Size(max = 100) String fullName
) {}
