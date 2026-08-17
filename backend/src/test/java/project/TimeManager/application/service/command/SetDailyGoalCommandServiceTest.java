package project.TimeManager.application.service.command;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import project.TimeManager.application.dto.command.SetDailyGoalCommand;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.port.out.tag.LoadTagPort;
import project.TimeManager.domain.port.out.tag.SaveTagPort;
import project.TimeManager.domain.port.out.tag.SaveTagsOrderPort;
import project.TimeManager.domain.port.out.tag.UpdateTagTimeBatchPort;
import project.TimeManager.domain.tag.model.Tag;
import project.TimeManager.domain.tag.model.TagId;
import project.TimeManager.domain.tag.model.TagType;
import project.TimeManager.domain.tag.model.TimerState;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;

@ExtendWith(MockitoExtension.class)
@DisplayName("TagCommandService.setDailyGoal — 오늘 목표 시간 설정")
class SetDailyGoalCommandServiceTest {

    private static final Long TAG_ID = 1L;
    private static final Long OWNER_ID = 7L;
    private static final ZonedDateTime EPOCH =
            ZonedDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneId.systemDefault());

    @Mock LoadTagPort loadTagPort;
    @Mock SaveTagPort saveTagPort;
    @Mock UpdateTagTimeBatchPort updateTagTimeBatchPort;
    @Mock SaveTagsOrderPort saveTagsOrderPort;

    private TagCommandService service;

    @BeforeEach
    void setUp() {
        service = new TagCommandService(loadTagPort, saveTagPort, updateTagTimeBatchPort, saveTagsOrderPort);
    }

    private Tag tagOwnedBy(Long memberId, Long dailyGoalTime) {
        return Tag.reconstitute(
                TagId.of(TAG_ID), "GoalTag", TagType.CUSTOM,
                0L, dailyGoalTime, 0L, 0L, 0L, 0L,
                EPOCH, EPOCH, TimerState.STOPPED, MemberId.of(memberId), null
        );
    }

    @Test
    @DisplayName("소유자가 설정하면 목표가 저장된다")
    void setsGoalForOwner() {
        Tag tag = tagOwnedBy(OWNER_ID, 0L);
        given(loadTagPort.loadTag(TAG_ID)).willReturn(Optional.of(tag));

        Long result = service.setDailyGoal(new SetDailyGoalCommand(TAG_ID, 3600L, OWNER_ID));

        assertThat(result).isEqualTo(TAG_ID);
        assertThat(tag.getDailyGoalTime()).isEqualTo(3600L);
        then(saveTagPort).should().saveTag(tag);
    }

    @Test
    @DisplayName("남의 태그면 거부하고 저장하지 않는다")
    void rejectsNonOwner() {
        Tag tag = tagOwnedBy(OWNER_ID, 1800L);
        given(loadTagPort.loadTag(TAG_ID)).willReturn(Optional.of(tag));

        assertThatThrownBy(() -> service.setDailyGoal(new SetDailyGoalCommand(TAG_ID, 3600L, 999L)))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("접근 권한");

        // 권한 검사가 도메인 변경보다 먼저 일어나야 한다 — 예외를 던져도 값이 바뀌면 의미가 없다.
        assertThat(tag.getDailyGoalTime()).isEqualTo(1800L);
        then(saveTagPort).should(never()).saveTag(tag);
    }

    @Test
    @DisplayName("없는 태그면 거부한다")
    void rejectsMissingTag() {
        given(loadTagPort.loadTag(TAG_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.setDailyGoal(new SetDailyGoalCommand(TAG_ID, 3600L, OWNER_ID)))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("Tag not found");
    }

    @ParameterizedTest(name = "{0}초는 허용")
    @ValueSource(longs = {0L, 1L, 86_400L})
    @DisplayName("경계값: 0(목표 없음)과 하루(86400초)는 허용")
    void acceptsBoundaryValues(long goal) {
        Tag tag = tagOwnedBy(OWNER_ID, 0L);
        given(loadTagPort.loadTag(TAG_ID)).willReturn(Optional.of(tag));

        service.setDailyGoal(new SetDailyGoalCommand(TAG_ID, goal, OWNER_ID));

        assertThat(tag.getDailyGoalTime()).isEqualTo(goal);
    }

    @ParameterizedTest(name = "{0}초는 거부")
    @ValueSource(longs = {-1L, 86_401L})
    @DisplayName("경계값: 음수와 하루 초과는 거부 — DTO 검증을 우회해도 도메인이 막는다")
    void rejectsOutOfRangeValues(long goal) {
        Tag tag = tagOwnedBy(OWNER_ID, 1800L);
        given(loadTagPort.loadTag(TAG_ID)).willReturn(Optional.of(tag));

        assertThatThrownBy(() -> service.setDailyGoal(new SetDailyGoalCommand(TAG_ID, goal, OWNER_ID)))
                .isInstanceOf(DomainException.class);

        assertThat(tag.getDailyGoalTime()).isEqualTo(1800L);
        then(saveTagPort).should(never()).saveTag(tag);
    }

    @Test
    @DisplayName("null 목표는 거부한다 — @NotNull 이 없는 경로로 들어와도 막힌다")
    void rejectsNullGoal() {
        Tag tag = tagOwnedBy(OWNER_ID, 1800L);
        given(loadTagPort.loadTag(TAG_ID)).willReturn(Optional.of(tag));

        assertThatThrownBy(() -> service.setDailyGoal(new SetDailyGoalCommand(TAG_ID, null, OWNER_ID)))
                .isInstanceOf(DomainException.class);

        assertThat(tag.getDailyGoalTime()).isEqualTo(1800L);
    }
}
