package project.TimeManager.domain.member.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.*;

@DisplayName("Member 도메인")
class MemberDomainTest {

    @Nested
    @DisplayName("Member.create (이름만)")
    class WhenCreatingWithNameOnly {

        @Test
        @DisplayName("유효한 이름으로 생성하면 이름이 설정된다")
        void shouldSetName_whenValidName() {
            Member member = Member.create("홍길동");

            assertThat(member.getName()).isEqualTo("홍길동");
            assertThat(member.getId()).isNull();
            assertThat(member.getEmail()).isNull();
        }

        @Test
        @DisplayName("이름이 null이면 IllegalArgumentException이 발생한다")
        void shouldThrow_whenNameIsNull() {
            assertThatIllegalArgumentException()
                    .isThrownBy(() -> Member.create(null))
                    .withMessageContaining("회원 이름은 필수입니다");
        }

        @ParameterizedTest
        @ValueSource(strings = {"", "  ", "\t", "\n"})
        @DisplayName("이름이 blank이면 IllegalArgumentException이 발생한다")
        void shouldThrow_whenNameIsBlank(String blankName) {
            assertThatIllegalArgumentException()
                    .isThrownBy(() -> Member.create(blankName))
                    .withMessageContaining("회원 이름은 필수입니다");
        }
    }

    @Nested
    @DisplayName("Member.register (이름 + 이메일 + 비밀번호)")
    class WhenRegistering {

        @Test
        @DisplayName("유효한 정보로 생성하면 모든 필드가 설정된다")
        void shouldSetAllFields_whenValid() {
            Member member = Member.register("홍길동", "hong@example.com", "hashed_pw");

            assertThat(member.getName()).isEqualTo("홍길동");
            assertThat(member.getEmail()).isEqualTo("hong@example.com");
            assertThat(member.getHashedPassword()).isEqualTo("hashed_pw");
        }

        @Test
        @DisplayName("이름이 null이면 IllegalArgumentException이 발생한다")
        void shouldThrow_whenNameIsNull() {
            assertThatIllegalArgumentException()
                    .isThrownBy(() -> Member.register(null, "hong@example.com", "hashed_pw"))
                    .withMessageContaining("회원 이름은 필수입니다");
        }

        @Test
        @DisplayName("이메일이 null이면 IllegalArgumentException이 발생한다")
        void shouldThrow_whenEmailIsNull() {
            assertThatIllegalArgumentException()
                    .isThrownBy(() -> Member.register("홍길동", null, "hashed_pw"))
                    .withMessageContaining("이메일은 필수입니다");
        }

        @Test
        @DisplayName("이메일이 blank이면 IllegalArgumentException이 발생한다")
        void shouldThrow_whenEmailIsBlank() {
            assertThatIllegalArgumentException()
                    .isThrownBy(() -> Member.register("홍길동", "  ", "hashed_pw"))
                    .withMessageContaining("이메일은 필수입니다");
        }

        @Test
        @DisplayName("비밀번호가 null이면 IllegalArgumentException이 발생한다")
        void shouldThrow_whenPasswordIsNull() {
            assertThatIllegalArgumentException()
                    .isThrownBy(() -> Member.register("홍길동", "hong@example.com", null))
                    .withMessageContaining("비밀번호는 필수입니다");
        }

        @Test
        @DisplayName("비밀번호가 blank이면 IllegalArgumentException이 발생한다")
        void shouldThrow_whenPasswordIsBlank() {
            assertThatIllegalArgumentException()
                    .isThrownBy(() -> Member.register("홍길동", "hong@example.com", "  "))
                    .withMessageContaining("비밀번호는 필수입니다");
        }
    }

    @Nested
    @DisplayName("Member.reconstitute")
    class WhenReconstituting {

        @Test
        @DisplayName("id, name, email, password로 복원하면 모든 필드가 설정된다")
        void shouldSetAllFields() {
            MemberId memberId = MemberId.of(42L);

            Member member = Member.reconstitute(memberId, "홍길동", "hong@example.com", "hashed_pw");

            assertThat(member.getId()).isEqualTo(memberId);
            assertThat(member.getName()).isEqualTo("홍길동");
            assertThat(member.getEmail()).isEqualTo("hong@example.com");
            assertThat(member.getHashedPassword()).isEqualTo("hashed_pw");
        }
    }
}
