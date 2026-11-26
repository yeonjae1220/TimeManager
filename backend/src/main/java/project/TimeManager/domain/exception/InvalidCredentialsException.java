package project.TimeManager.domain.exception;

/**
 * 이메일 로그인 실패 — 없는 이메일·소셜 전용 계정·틀린 비밀번호를 구분하지 않는다(가입 여부 비노출).
 * GlobalExceptionHandler 가 401 로 매핑한다. DomainException 하위 타입이라 기존 catch 는 그대로 동작한다.
 */
public class InvalidCredentialsException extends DomainException {
    public InvalidCredentialsException(String message) {
        super(message);
    }
}
