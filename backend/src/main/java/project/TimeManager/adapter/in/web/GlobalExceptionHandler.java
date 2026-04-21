package project.TimeManager.adapter.in.web;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.exception.RecordOverlapException;
import project.TimeManager.domain.port.out.record.FindOverlappingRecordsPort.OverlapResult;

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
                "recordsToDelete", recordsToDelete
        ));
    }

    @ExceptionHandler(DomainException.class)
    public ResponseEntity<Map<String, String>> handleDomainException(DomainException e) {
        log.warn("Domain rule violation: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", e.getMessage()));
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

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpected(Exception e) {
        log.error("Unexpected error", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Internal server error"));
    }
}
