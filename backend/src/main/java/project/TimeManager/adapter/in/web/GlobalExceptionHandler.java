package project.TimeManager.adapter.in.web;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.exception.InvalidCredentialsException;
import project.TimeManager.domain.exception.RecordOverlapException;
import project.TimeManager.domain.exception.ResourceForbiddenException;
import project.TimeManager.domain.exception.TooManyRequestsException;
import project.TimeManager.domain.port.out.record.FindOverlappingRecordsPort.OverlapResult;

import java.sql.SQLException;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 시간대 중복 — 409 Conflict
     * 프론트엔드는 이 응답으로 2단계 확인 모달을 구성합니다.
     * 1단계: overlappingTags (중복된 태그 목록)
     * 2단계: recordsToDelete (삭제될 레코드 목록) + 되돌릴 수 없다는 안내
     */
    @ExceptionHandler(RecordOverlapException.class)
    public ResponseEntity<Map<String, Object>> handleRecordOverlap(RecordOverlapException e) {
        log.warn("Record overlap detected: {} overlapping records", e.getOverlaps().size());

        // 1단계용: 태그 중복 제거
        List<Map<String, Object>> overlappingTags = e.getOverlaps().stream()
                .collect(Collectors.toMap(
                        OverlapResult::tagId,
                        o -> Map.<String, Object>of("tagId", o.tagId(), "tagName", o.tagName()),
                        (a, b) -> a))
                .values()
                .stream()
                .toList();

        // 2단계용: 삭제될 레코드 전체 목록
        List<Map<String, Object>> recordsToDelete = e.getOverlaps().stream()
                .map(o -> Map.<String, Object>of(
                        "recordId", o.recordId(),
                        "tagName", o.tagName(),
                        "startTime", o.startTime(),
                        "endTime", o.endTime()
                ))
                .toList();

        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "code", "RECORD_OVERLAP",
                "overlappingTags", overlappingTags,
                "recordsToDelete", recordsToDelete,
                "overlapToken", RecordOverlapException.token(e.getOverlaps())
        ));
    }

    @ExceptionHandler(project.TimeManager.domain.exception.RecordChangedException.class)
    public ResponseEntity<Map<String, String>> handleRecordChanged() {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("code", "RECORD_CHANGED"));
    }

    @ExceptionHandler(TooManyRequestsException.class)
    public ResponseEntity<Map<String, String>> handleTooManyRequests(TooManyRequestsException e) {
        log.warn("Rate limit exceeded: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(ResourceForbiddenException.class)
    public ResponseEntity<Map<String, String>> handleForbidden(ResourceForbiddenException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
    }

    /** 이메일 로그인 실패 — 401. 문구는 실패 사유와 무관하게 하나(가입 여부 비노출). */
    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<Map<String, String>> handleInvalidCredentials(InvalidCredentialsException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(DomainException.class)
    public ResponseEntity<Map<String, String>> handleDomainException(DomainException e) {
        log.warn("Domain rule violation: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, String>> handleInvalidParameter(MethodArgumentTypeMismatchException e) {
        return ResponseEntity.badRequest().body(Map.of("error", "Invalid parameter: " + e.getName()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException e) {
        log.warn("Illegal argument: {}", e.getMessage());
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return ResponseEntity.badRequest().body(Map.of("error", message));
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<Map<String, String>> handleConcurrencyConflict(OptimisticLockingFailureException e) {
        log.warn("Concurrent modification conflict: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", "요청이 충돌했습니다. 다시 시도해 주세요"));
    }

    /**
     * 유니크 제약 위반(PostgreSQL 23505) — 409. 같은 이메일·같은 소셜 계정으로 가입 요청이 동시에 두 번
     * 들어와 앞 요청이 먼저 저장된 경우다. 성공으로 넘기지 않는다(뒤 요청이 만든 것은 없다).
     * 그 밖의 무결성 위반(NOT NULL·FK 등)은 코드 결함이므로 500 으로 둔다.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDataIntegrity(DataIntegrityViolationException e) {
        if (isUniqueViolation(e)) {
            log.warn("Unique constraint conflict: {}", e.getMostSpecificCause().getClass().getSimpleName());
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "요청이 충돌했습니다. 잠시 후 다시 시도해 주세요"));
        }
        return handleUnexpected(e);
    }

    private static final String UNIQUE_VIOLATION_SQLSTATE = "23505";

    private static boolean isUniqueViolation(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof SQLException sql && UNIQUE_VIOLATION_SQLSTATE.equals(sql.getSQLState())) {
                return true;
            }
            if (t.getCause() == t) break;
        }
        return false;
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpected(Exception e) {
        log.error("Unexpected error", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Internal server error"));
    }
}
