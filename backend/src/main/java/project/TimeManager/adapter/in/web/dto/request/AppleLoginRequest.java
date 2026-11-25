package project.TimeManager.adapter.in.web.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * @param fullName Apple 이 최초 승인 때만 앱에 주는 이름. 이후 로그인에선 비어 온다.
 * @param authorizationCode 계정 삭제 시 Apple 토큰 철회(가이드라인 5.1.1(v))를 위해 앱이 미리 넘기는 값.
 *                          철회 구현(.p8 키 필요) 전까지 서버는 받기만 하고 쓰지 않는다 — 앱 바이너리가
 *                          웹보다 드물게 배포되므로 필드를 먼저 열어 둔다.
 */
public record AppleLoginRequest(
        @NotBlank @Size(max = 4096) String identityToken,
        @Size(max = 1024) String authorizationCode,
        @NotBlank @Size(max = 128) String nonce,
        @Size(max = 100) String fullName
) {}
