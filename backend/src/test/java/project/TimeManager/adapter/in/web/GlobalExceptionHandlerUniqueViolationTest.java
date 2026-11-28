package project.TimeManager.adapter.in.web;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;

import java.sql.SQLException;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("GlobalExceptionHandler — 무결성 위반")
class GlobalExceptionHandlerUniqueViolationTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    @DisplayName("유니크 위반(23505)은 409 로 응답한다 — 동시 가입의 뒤 요청")
    void uniqueViolationIsConflict() {
        var e = new DataIntegrityViolationException("dup",
                new RuntimeException("wrapped", new SQLException("duplicate key", "23505")));

        assertThat(handler.handleDataIntegrity(e).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    @DisplayName("그 밖의 무결성 위반(NOT NULL 23502 등)은 코드 결함이므로 500 으로 둔다")
    void otherIntegrityViolationIsServerError() {
        var e = new DataIntegrityViolationException("null", new SQLException("null value", "23502"));

        assertThat(handler.handleDataIntegrity(e).getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
