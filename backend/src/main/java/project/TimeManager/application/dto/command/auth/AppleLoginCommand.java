package project.TimeManager.application.dto.command.auth;

/**
 * @param fullName Apple 은 이름을 **최초 승인 때 한 번만** 앱에 준다(토큰에는 없다). 이후 로그인에선 null.
 */
public record AppleLoginCommand(String identityToken, String rawNonce, String fullName) {}
