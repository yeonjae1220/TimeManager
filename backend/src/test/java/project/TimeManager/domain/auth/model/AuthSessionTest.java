package project.TimeManager.domain.auth.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import project.TimeManager.domain.member.model.MemberId;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.*;

@DisplayName("AuthSession 도메인")
class AuthSessionTest {

    private static final MemberId MEMBER_ID = MemberId.of(1L);
    private static final String REFRESH_TOKEN = "refresh-token-abc";

    @Nested
    @DisplayName("isExpired")
    class WhenCheckingExpiry {

        @Test
        @DisplayName("만료 시간이 미래이면 false를 반환한다")
        void shouldReturnFalse_whenNotExpired() {
            Instant future = Instant.now().plus(7, ChronoUnit.DAYS);
            AuthSession session = AuthSession.create(MEMBER_ID, REFRESH_TOKEN, future);

            assertThat(session.isExpired()).isFalse();
        }

        @Test
        @DisplayName("만료 시간이 과거이면 true를 반환한다")
        void shouldReturnTrue_whenExpired() {
            Instant past = Instant.now().minus(1, ChronoUnit.SECONDS);
            AuthSession session = AuthSession.create(MEMBER_ID, REFRESH_TOKEN, past);

            assertThat(session.isExpired()).isTrue();
        }
    }

    @Nested
    @DisplayName("isRotatedRecently")
    class WhenCheckingRotationRecency {

        @Test
        @DisplayName("create 직후에는 24시간 이내이므로 true를 반환한다")
        void shouldReturnTrue_whenJustCreated() {
            AuthSession session = AuthSession.create(MEMBER_ID, REFRESH_TOKEN,
                    Instant.now().plus(30, ChronoUnit.DAYS));

            assertThat(session.isRotatedRecently(Duration.ofHours(24))).isTrue();
        }

        @Test
        @DisplayName("lastRotatedAt이 interval보다 과거이면 false를 반환한다")
        void shouldReturnFalse_whenRotatedBeforeInterval() {
            Instant oldRotation = Instant.now().minus(25, ChronoUnit.HOURS);
            AuthSession session = AuthSession.reconstitute(MEMBER_ID, REFRESH_TOKEN,
                    Instant.now().plus(30, ChronoUnit.DAYS), oldRotation);

            assertThat(session.isRotatedRecently(Duration.ofHours(24))).isFalse();
        }

        @Test
        @DisplayName("reconstitute 시 lastRotatedAt이 null이면 Instant.EPOCH로 처리해 false를 반환한다")
        void shouldReturnFalse_whenLastRotatedAtIsNull() {
            AuthSession session = AuthSession.reconstitute(MEMBER_ID, REFRESH_TOKEN,
                    Instant.now().plus(30, ChronoUnit.DAYS), null);

            assertThat(session.isRotatedRecently(Duration.ofHours(24))).isFalse();
        }
    }

    @Nested
    @DisplayName("rotate")
    class WhenRotating {

        @Test
        @DisplayName("rotate 후 refreshToken과 expiresAt이 교체된다")
        void shouldUpdateTokenAndExpiry_afterRotate() {
            Instant originalExpiry = Instant.now().plus(7, ChronoUnit.DAYS);
            AuthSession session = AuthSession.create(MEMBER_ID, REFRESH_TOKEN, originalExpiry);

            String newToken = "new-refresh-token";
            Instant newExpiry = Instant.now().plus(14, ChronoUnit.DAYS);
            session.rotate(newToken, newExpiry);

            assertThat(session.getRefreshToken()).isEqualTo(newToken);
            assertThat(session.getExpiresAt()).isEqualTo(newExpiry);
        }

        @Test
        @DisplayName("rotate 후 memberId는 변경되지 않는다")
        void shouldNotChangeMemberId_afterRotate() {
            AuthSession session = AuthSession.create(MEMBER_ID, REFRESH_TOKEN, Instant.now().plus(7, ChronoUnit.DAYS));

            session.rotate("new-token", Instant.now().plus(7, ChronoUnit.DAYS));

            assertThat(session.getMemberId()).isEqualTo(MEMBER_ID);
        }

        @Test
        @DisplayName("rotate 후 lastRotatedAt이 현재 시각으로 갱신되어 isRotatedRecently가 true를 반환한다")
        void shouldUpdateLastRotatedAt_afterRotate() {
            Instant oldRotation = Instant.now().minus(25, ChronoUnit.HOURS);
            AuthSession session = AuthSession.reconstitute(MEMBER_ID, REFRESH_TOKEN,
                    Instant.now().plus(30, ChronoUnit.DAYS), oldRotation);
            assertThat(session.isRotatedRecently(Duration.ofHours(24))).isFalse();

            session.rotate("new-token", Instant.now().plus(30, ChronoUnit.DAYS));

            assertThat(session.isRotatedRecently(Duration.ofHours(24))).isTrue();
        }
    }

    @Nested
    @DisplayName("AuthSession.create")
    class WhenCreating {

        @Test
        @DisplayName("create로 생성하면 모든 필드가 설정되고 lastRotatedAt은 현재 시각으로 초기화된다")
        void shouldSetAllFields() {
            Instant before = Instant.now();
            Instant expiry = Instant.now().plus(7, ChronoUnit.DAYS);

            AuthSession session = AuthSession.create(MEMBER_ID, REFRESH_TOKEN, expiry);

            assertThat(session.getMemberId()).isEqualTo(MEMBER_ID);
            assertThat(session.getRefreshToken()).isEqualTo(REFRESH_TOKEN);
            assertThat(session.getExpiresAt()).isEqualTo(expiry);
            assertThat(session.getLastRotatedAt()).isAfterOrEqualTo(before);
        }
    }
}
