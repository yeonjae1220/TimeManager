package project.TimeManager.adapter.in.web.dto.request;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("RegisterMemberRequest 비밀번호 복잡도 검증")
class RegisterMemberRequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    @Test
    @DisplayName("대소문자/숫자/특수문자를 모두 포함한 8자 이상 비밀번호는 통과한다")
    void validPassword_passes() {
        Set<ConstraintViolation<RegisterMemberRequest>> violations =
                validator.validate(request("Password123!"));

        assertThat(violations).isEmpty();
    }

    @ParameterizedTest
    @DisplayName("복잡도 요건을 하나라도 빠뜨리거나 너무 짧은 비밀번호는 거부된다")
    @ValueSource(strings = {
            "Sh1!",       // 8자 미만 (4자)
            "alllowercase123!", // 대문자 없음
            "ALLUPPERCASE123!", // 소문자 없음
            "NoDigitsHere!!", // 숫자 없음
            "NoSpecialChar123", // 특수문자 없음
    })
    void invalidPassword_isRejected(String password) {
        Set<ConstraintViolation<RegisterMemberRequest>> violations =
                validator.validate(request(password));

        assertThat(violations).isNotEmpty();
    }

    private RegisterMemberRequest request(String password) {
        return new RegisterMemberRequest("name", "user@example.com", password);
    }
}
