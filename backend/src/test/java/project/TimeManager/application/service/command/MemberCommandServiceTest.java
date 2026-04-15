package project.TimeManager.application.service.command;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import project.TimeManager.application.dto.command.member.RegisterMemberCommand;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.member.model.MemberCredentials;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.member.model.MemberRole;
import project.TimeManager.domain.port.out.auth.LoadMemberCredentialsPort;
import project.TimeManager.domain.port.out.auth.PasswordHasherPort;
import project.TimeManager.domain.port.out.member.InitializeMemberTagsPort;
import project.TimeManager.domain.port.out.member.SaveMemberPort;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("MemberCommandService")
class MemberCommandServiceTest {

    @Mock SaveMemberPort saveMemberPort;
    @Mock InitializeMemberTagsPort initializeMemberTagsPort;
    @Mock LoadMemberCredentialsPort loadMemberCredentialsPort;
    @Mock PasswordHasherPort passwordHasherPort;

    @InjectMocks MemberCommandService memberCommandService;

    @Nested
    @DisplayName("register")
    class WhenRegistering {

        @Test
        @DisplayName("유효한 정보로 가입하면 MemberId를 반환한다")
        void shouldReturnMemberId_whenValid() {
            // Arrange
            given(loadMemberCredentialsPort.findByEmail("hong@example.com")).willReturn(Optional.empty());
            given(passwordHasherPort.hash("plainPw")).willReturn("hashed_pw");
            given(saveMemberPort.saveMember(any())).willReturn(42L);

            RegisterMemberCommand command = new RegisterMemberCommand("홍길동", "hong@example.com", "plainPw");

            // Act
            MemberId memberId = memberCommandService.register(command);

            // Assert
            assertThat(memberId).isEqualTo(MemberId.of(42L));
            then(initializeMemberTagsPort).should().initializeDefaultTags(MemberId.of(42L));
        }

        @Test
        @DisplayName("이미 사용 중인 이메일로 가입하면 DomainException이 발생한다")
        void shouldThrow_whenEmailAlreadyExists() {
            MemberCredentials existing = new MemberCredentials(MemberId.of(1L), "some_hash", MemberRole.MEMBER);
            given(loadMemberCredentialsPort.findByEmail("existing@example.com")).willReturn(Optional.of(existing));

            RegisterMemberCommand command = new RegisterMemberCommand("홍길동", "existing@example.com", "plainPw");

            assertThatThrownBy(() -> memberCommandService.register(command))
                    .isInstanceOf(DomainException.class)
                    .hasMessageContaining("이미 사용 중인 이메일입니다");
        }

        @Test
        @DisplayName("가입 성공 시 비밀번호 해싱이 수행된다")
        void shouldHashPassword_whenRegistering() {
            given(loadMemberCredentialsPort.findByEmail(anyString())).willReturn(Optional.empty());
            given(passwordHasherPort.hash("plainPw")).willReturn("hashed_pw");
            given(saveMemberPort.saveMember(any())).willReturn(1L);

            memberCommandService.register(new RegisterMemberCommand("홍길동", "hong@example.com", "plainPw"));

            then(passwordHasherPort).should().hash("plainPw");
        }

        @Test
        @DisplayName("가입 성공 시 기본 태그 초기화가 수행된다")
        void shouldInitializeDefaultTags_afterSave() {
            given(loadMemberCredentialsPort.findByEmail(anyString())).willReturn(Optional.empty());
            given(passwordHasherPort.hash(anyString())).willReturn("hashed_pw");
            given(saveMemberPort.saveMember(any())).willReturn(10L);

            memberCommandService.register(new RegisterMemberCommand("홍길동", "hong@example.com", "plainPw"));

            then(initializeMemberTagsPort).should().initializeDefaultTags(MemberId.of(10L));
        }
    }
}
