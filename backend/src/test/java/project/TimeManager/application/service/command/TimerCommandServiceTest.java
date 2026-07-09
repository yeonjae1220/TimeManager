package project.TimeManager.application.service.command;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import project.TimeManager.application.dto.command.CreateRecordCommand;
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
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
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

    private Tag runningTagOwnedBy(Long tagId, Long memberId, ZonedDateTime latestStartTime) {
        return Tag.reconstitute(
                TagId.of(tagId),
                "RunningTag",
                TagType.CUSTOM,
                0L,
                0L,
                0L,
                0L,
                0L,
                0L,
                latestStartTime,
                ZonedDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneId.systemDefault()),
                TimerState.RUNNING,
                MemberId.of(memberId),
                null
        );
    }

    @Test
    @DisplayName("[④자동정지] startTimer는 같은 멤버의 다른 실행 중 태그를 자동 정지하고 그 세션을 기록한다")
    void startTimer_autoStopsOtherRunningTagAndRecordsSession() {
        Tag target = tagOwnedBy(10L, 1L);
        Tag running = runningTagOwnedBy(20L, 1L, START.minusMinutes(5));
        given(loadTagPort.loadTag(10L)).willReturn(Optional.of(target));
        given(loadTagPort.findRunningTagsByMemberId(1L)).willReturn(List.of(running));

        timerCommandService.startTimer(new StartTimerCommand(10L, START, 1L));

        // 실행 중이던 다른 태그는 정지되어 저장되고, 세션이 기록된다
        assertThat(running.getTimerState()).isEqualTo(TimerState.STOPPED);
        then(saveTagPort).should().saveTag(running);
        then(createRecordUseCase).should().createRecord(any(CreateRecordCommand.class));

        // 대상 태그는 시작되어 저장된다
        assertThat(target.getTimerState()).isEqualTo(TimerState.RUNNING);
        then(saveTagPort).should().saveTag(target);
    }

    @Test
    @DisplayName("[④자동정지-다중] startTimer는 실행 중인 태그가 여러 개면 모두 정지·기록한다(reset 결함으로 누적된 다중 러닝 복구)")
    void startTimer_autoStopsAllRunningTags() {
        Tag target = tagOwnedBy(10L, 1L);
        Tag running1 = runningTagOwnedBy(20L, 1L, START.minusMinutes(5));
        Tag running2 = runningTagOwnedBy(30L, 1L, START.minusHours(3));
        given(loadTagPort.loadTag(10L)).willReturn(Optional.of(target));
        given(loadTagPort.findRunningTagsByMemberId(1L)).willReturn(List.of(running1, running2));

        timerCommandService.startTimer(new StartTimerCommand(10L, START, 1L));

        assertThat(running1.getTimerState()).isEqualTo(TimerState.STOPPED);
        assertThat(running2.getTimerState()).isEqualTo(TimerState.STOPPED);
        then(saveTagPort).should().saveTag(running1);
        then(saveTagPort).should().saveTag(running2);
        // 정지된 태그 2개 각각에 대해 세션이 기록된다(대상 태그 시작은 기록 없음)
        then(createRecordUseCase).should(org.mockito.Mockito.times(2)).createRecord(any(CreateRecordCommand.class));
        assertThat(target.getTimerState()).isEqualTo(TimerState.RUNNING);
    }

    @Test
    @DisplayName("[④자동정지] startTimer는 대상 태그 자신이 이미 실행 중이어도 자기 자신은 자동정지 대상에서 제외한다")
    void startTimer_doesNotAutoStopItself() {
        Tag target = runningTagOwnedBy(10L, 1L, START.minusMinutes(1));
        given(loadTagPort.loadTag(10L)).willReturn(Optional.of(target));
        given(loadTagPort.findRunningTagsByMemberId(1L)).willReturn(List.of(target));

        timerCommandService.startTimer(new StartTimerCommand(10L, START, 1L));

        // 자기 자신에 대한 기록 생성은 없어야 한다
        then(createRecordUseCase).shouldHaveNoInteractions();
        assertThat(target.getTimerState()).isEqualTo(TimerState.RUNNING);
    }

    @Test
    @DisplayName("[리셋정지] resetTimer는 서버측 실행 중 상태를 실제로 정지시킨다(유령 러닝 근본 원인 수정) — 기록은 만들지 않는다")
    void resetTimer_stopsServerSideRunningStateWithoutCreatingRecord() {
        Tag running = runningTagOwnedBy(10L, 1L, START.minusHours(67));
        given(loadTagPort.loadTag(10L)).willReturn(Optional.of(running));

        timerCommandService.resetTimer(new ResetTimerCommand(10L, 0L, 1L));

        assertThat(running.getTimerState()).isEqualTo(TimerState.STOPPED);
        assertThat(running.getElapsedTime()).isZero();
        then(saveTagPort).should().saveTag(running);
        // reset은 세션 종료가 아니라 초기화이므로 record를 남기지 않는다
        then(createRecordUseCase).shouldHaveNoInteractions();
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
