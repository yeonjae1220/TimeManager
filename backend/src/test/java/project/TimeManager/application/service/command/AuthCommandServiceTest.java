package project.TimeManager.application.service.command;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import project.TimeManager.application.dto.command.auth.LoginCommand;
import project.TimeManager.application.dto.command.auth.LogoutCommand;
import project.TimeManager.application.dto.command.auth.RefreshTokenCommand;
import project.TimeManager.application.dto.result.TokenPairResult;
import project.TimeManager.domain.auth.model.AuthSession;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.member.model.MemberCredentials;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.member.model.MemberRole;
import project.TimeManager.domain.port.out.auth.LoadMemberCredentialsPort;
import project.TimeManager.domain.port.out.auth.PasswordHasherPort;
import project.TimeManager.domain.port.out.auth.TokenGeneratorPort;
import project.TimeManager.domain.port.out.auth.TokenStorePort;
import project.TimeManager.domain.port.out.member.LoadMemberPort;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthCommandService")
class AuthCommandServiceTest {

    @Mock LoadMemberCredentialsPort loadMemberCredentialsPort;
    @Mock PasswordHasherPort passwordHasherPort;
    @Mock TokenStorePort tokenStorePort;
    @Mock TokenGeneratorPort tokenGeneratorPort;
    @Mock LoadMemberPort loadMemberPort;

    @InjectMocks AuthCommandService authCommandService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(authCommandService, "rotationIntervalHours", 24L);
    }

    private static final MemberId MEMBER_ID = MemberId.of(1L);
    private static final String EMAIL = "user@example.com";
    private static final String PASSWORD = "plainPassword";
    private static final String HASHED_PASSWORD = "hashed_password";
    private static final String ACCESS_TOKEN = "access-token";
    private static final String REFRESH_TOKEN = "refresh-token";

    @Nested
    @DisplayName("login")
    class WhenLoggingIn {

        @Test
        @DisplayName("이메일과 비밀번호가 올바르면 토큰 쌍을 반환한다")
        void shouldReturnTokenPair_whenCredentialsValid() {
            MemberCredentials credentials = new MemberCredentials(MEMBER_ID, HASHED_PASSWORD, MemberRole.MEMBER);
            given(loadMemberCredentialsPort.findByEmail(EMAIL)).willReturn(Optional.of(credentials));
            given(passwordHasherPort.matches(PASSWORD, HASHED_PASSWORD)).willReturn(true);
            given(tokenGeneratorPort.generateAccessToken(eq(MEMBER_ID), any(MemberRole.class))).willReturn(ACCESS_TOKEN);
            given(tokenGeneratorPort.generateRefreshToken()).willReturn(REFRESH_TOKEN);

            TokenPairResult result = authCommandService.login(new LoginCommand(EMAIL, PASSWORD));

            assertThat(result.accessToken()).isEqualTo(ACCESS_TOKEN);
            assertThat(result.refreshToken()).isEqualTo(REFRESH_TOKEN);
            assertThat(result.memberId()).isEqualTo(MEMBER_ID.value());
            then(tokenStorePort).should().save(any(AuthSession.class));
        }

        @Test
        @DisplayName("존재하지 않는 이메일로 로그인하면 DomainException이 발생한다")
        void shouldThrow_whenEmailNotFound() {
            given(loadMemberCredentialsPort.findByEmail(anyString())).willReturn(Optional.empty());

            assertThatThrownBy(() -> authCommandService.login(new LoginCommand("notfound@example.com", PASSWORD)))
                    .isInstanceOf(DomainException.class)
                    .hasMessageContaining("이메일 또는 비밀번호가 올바르지 않습니다");
        }

        @Test
        @DisplayName("비밀번호가 틀리면 DomainException이 발생한다")
        void shouldThrow_whenPasswordIncorrect() {
            MemberCredentials credentials = new MemberCredentials(MEMBER_ID, HASHED_PASSWORD, MemberRole.MEMBER);
            given(loadMemberCredentialsPort.findByEmail(EMAIL)).willReturn(Optional.of(credentials));
            given(passwordHasherPort.matches(anyString(), anyString())).willReturn(false);

            assertThatThrownBy(() -> authCommandService.login(new LoginCommand(EMAIL, "wrongPassword")))
                    .isInstanceOf(DomainException.class)
                    .hasMessageContaining("이메일 또는 비밀번호가 올바르지 않습니다");
        }
    }

    @Nested
    @DisplayName("refresh")
    class WhenRefreshing {

        @Test
        @DisplayName("24시간 이내 회전한 세션이면 토큰을 재사용하고 새 accessToken만 발급한다")
        void shouldReuseRefreshToken_whenRotatedRecently() {
            // Arrange — lastRotatedAt = now (create 직후) → 회전 인터벌 내
            Instant future = Instant.now().plus(30, ChronoUnit.DAYS);
            AuthSession recentSession = AuthSession.create(MEMBER_ID, REFRESH_TOKEN, future);
            given(tokenStorePort.findByRefreshToken(REFRESH_TOKEN)).willReturn(Optional.of(recentSession));
            given(tokenGeneratorPort.generateAccessToken(eq(MEMBER_ID), any(MemberRole.class))).willReturn(ACCESS_TOKEN);

            // Act
            TokenPairResult result = authCommandService.refresh(new RefreshTokenCommand(REFRESH_TOKEN));

            // Assert
            assertThat(result.accessToken()).isEqualTo(ACCESS_TOKEN);
            assertThat(result.refreshToken()).isEqualTo(REFRESH_TOKEN);  // 원래 토큰 재사용
            then(tokenStorePort).should(never()).delete(anyString());     // 삭제 없음
            then(tokenStorePort).should(never()).save(any());             // 저장 없음
        }

        @Test
        @DisplayName("24시간 이상 지난 세션이면 토큰을 회전하고 새 토큰 쌍을 반환한다")
        void shouldRotateToken_whenRotationIntervalElapsed() {
            // Arrange — lastRotatedAt = 25시간 전 → 회전 인터벌 초과
            Instant oldRotation = Instant.now().minus(25, ChronoUnit.HOURS);
            AuthSession oldSession = AuthSession.reconstitute(MEMBER_ID, REFRESH_TOKEN,
                    Instant.now().plus(30, ChronoUnit.DAYS), oldRotation);
            given(tokenStorePort.findByRefreshToken(REFRESH_TOKEN)).willReturn(Optional.of(oldSession));

            String newRefreshToken = "new-refresh-token";
            String newAccessToken = "new-access-token";
            given(tokenGeneratorPort.generateRefreshToken()).willReturn(newRefreshToken);
            given(tokenGeneratorPort.generateAccessToken(eq(MEMBER_ID), any(MemberRole.class))).willReturn(newAccessToken);

            // Act
            TokenPairResult result = authCommandService.refresh(new RefreshTokenCommand(REFRESH_TOKEN));

            // Assert
            assertThat(result.accessToken()).isEqualTo(newAccessToken);
            assertThat(result.refreshToken()).isEqualTo(newRefreshToken);  // 새 토큰
            then(tokenStorePort).should().delete(REFRESH_TOKEN);           // 기존 토큰 삭제
            then(tokenStorePort).should().save(oldSession);                // 회전된 세션 저장
        }

        @Test
        @DisplayName("존재하지 않는 리프레시 토큰이면 DomainException이 발생한다")
        void shouldThrow_whenTokenNotFound() {
            given(tokenStorePort.findByRefreshToken(anyString())).willReturn(Optional.empty());

            assertThatThrownBy(() -> authCommandService.refresh(new RefreshTokenCommand("invalid-token")))
                    .isInstanceOf(DomainException.class)
                    .hasMessageContaining("유효하지 않은 리프레시 토큰입니다");
        }

        @Test
        @DisplayName("만료된 리프레시 토큰이면 삭제 후 DomainException이 발생한다")
        void shouldDeleteAndThrow_whenTokenExpired() {
            Instant past = Instant.now().minus(1, ChronoUnit.SECONDS);
            AuthSession expiredSession = AuthSession.create(MEMBER_ID, REFRESH_TOKEN, past);
            given(tokenStorePort.findByRefreshToken(REFRESH_TOKEN)).willReturn(Optional.of(expiredSession));

            assertThatThrownBy(() -> authCommandService.refresh(new RefreshTokenCommand(REFRESH_TOKEN)))
                    .isInstanceOf(DomainException.class)
                    .hasMessageContaining("만료된 리프레시 토큰입니다");

            then(tokenStorePort).should().delete(REFRESH_TOKEN);
        }
    }

    @Nested
    @DisplayName("logout")
    class WhenLoggingOut {

        @Test
        @DisplayName("로그아웃 시 해당 리프레시 토큰이 삭제된다")
        void shouldDeleteRefreshToken_onLogout() {
            authCommandService.logout(new LogoutCommand(REFRESH_TOKEN));

            then(tokenStorePort).should().delete(REFRESH_TOKEN);
        }
    }
}
