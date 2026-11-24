package project.TimeManager.domain.exception;

public class ResourceForbiddenException extends RuntimeException {
    public ResourceForbiddenException() {
        super("접근 권한이 없습니다");
    }
}
