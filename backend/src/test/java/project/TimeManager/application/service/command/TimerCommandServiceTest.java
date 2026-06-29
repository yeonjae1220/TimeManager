package project.TimeManager.application.service.command;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import project.TimeManager.application.dto.command.ResetTimerCommand;
import project.TimeManager.application.dto.command.StartTimerCommand;
import project.TimeManager.application.dto.command.StopTimerCommand;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.port.in.record.CreateRecordUseCase;
import project.TimeManager.domain.port.out.tag.LoadTagPort;
import project.TimeManager.domain.port.out.tag.SaveTagPort;
import project.TimeManager.domain.tag.model.Tag;
import project.TimeManager.domain.tag.model.TagId;
import project.TimeManager.domain.tag.model.TagType;
import project.TimeManager.domain.tag.model.TimerState;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;

@ExtendWith(MockitoExtension.class)
@DisplayName("TimerCommandService")
class TimerCommandServiceTest {

    @Mock LoadTagPort loadTagPort;
    @Mock SaveTagPort saveTagPort;
    @Mock CreateRecordUseCase createRecordUseCase;

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final ZonedDateTime START = ZonedDateTime.of(2026, 6, 25, 10, 0, 0, 0, SEOUL);
    private static final ZonedDateTime END = START.plusMinutes(10);

    private TimerCommandService timerCommandService;

    @BeforeEach
    void setUp() {
        timerCommandService = new TimerCommandService(loadTagPort, saveTagPort, createRecordUseCase);
    }

    private Tag tagOwnedBy(Long tagId, Long memberId) {
        return Tag.reconstitute(
                TagId.of(tagId),
                "TimerTag",
                TagType.CUSTOM,
                0L,
                0L,
                0L,
                0L,
                0L,
                0L,
                ZonedDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneId.systemDefault()),
                ZonedDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneId.systemDefault()),
                TimerState.STOPPED,
                MemberId.of(memberId),
                null
        );
    }

    @Test
    @DisplayName("startTimer는 다른 멤버의 태그를 시작할 수 없다")
    void startTimer_shouldRejectOtherMembersTag() {
        given(loadTagPort.loadTag(10L)).willReturn(Optional.of(tagOwnedBy(10L, 99L)));

        assertThatThrownBy(() -> timerCommandService.startTimer(new StartTimerCommand(10L, START, 1L)))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("접근 권한이 없습니다");

        then(loadTagPort).shouldHaveNoMoreInteractions();
        then(saveTagPort).shouldHaveNoInteractions();
        then(createRecordUseCase).shouldHaveNoInteractions();
    }

    @Test
    @DisplayName("stopTimer는 다른 멤버의 태그를 정지하거나 기록을 생성할 수 없다")
    void stopTimer_shouldRejectOtherMembersTag() {
        given(loadTagPort.loadTag(10L)).willReturn(Optional.of(tagOwnedBy(10L, 99L)));

        assertThatThrownBy(() -> timerCommandService.stopTimer(new StopTimerCommand(10L, 600L, START, END, 1L)))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("접근 권한이 없습니다");

        then(loadTagPort).shouldHaveNoMoreInteractions();
        then(saveTagPort).shouldHaveNoInteractions();
        then(createRecordUseCase).shouldHaveNoInteractions();
    }

    @Test
    @DisplayName("resetTimer는 다른 멤버의 태그 elapsedTime을 초기화할 수 없다")
    void resetTimer_shouldRejectOtherMembersTag() {
        given(loadTagPort.loadTag(10L)).willReturn(Optional.of(tagOwnedBy(10L, 99L)));

        assertThatThrownBy(() -> timerCommandService.resetTimer(new ResetTimerCommand(10L, 0L, 1L)))
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("접근 권한이 없습니다");

        then(loadTagPort).shouldHaveNoMoreInteractions();
        then(saveTagPort).shouldHaveNoInteractions();
        then(createRecordUseCase).shouldHaveNoInteractions();
    }
}
