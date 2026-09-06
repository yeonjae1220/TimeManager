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
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.ArgumentCaptor;

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

    private Tag stoppedTagWithLastStop(Long tagId, Long memberId, ZonedDateTime latestStopTime) {
        return Tag.reconstitute(
                TagId.of(tagId),
                "StoppedTag",
                TagType.CUSTOM,
                0L, 0L, 0L, 0L, 0L, 0L,
                ZonedDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneId.systemDefault()),
                latestStopTime,
                TimerState.STOPPED,
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

    // ── 유령 정지 방어 ────────────────────────────────────────────────────────────
    // 다른 기기에서 이미 정지된 세션을, 옛 시작시각을 든 채 남아 있던 기기가 다시 정지시키면
    // 서버가 그 구간을 그대로 믿고 거대한 기록을 만들던 결함에 대한 회귀 테스트.

    @Test
    @DisplayName("[유령정지] 실행 중이면 기록 구간의 시작은 클라이언트 값이 아니라 서버의 latestStartTime 을 쓴다")
    void stopTimer_usesServerAnchorAsRecordStart_whenRunning() {
        // Arrange — 서버는 10:00 에 시작했다고 알고 있는데, 클라이언트는 stale 한 2:13 을 보낸다.
        ZonedDateTime serverAnchor = START;
        ZonedDateTime staleClientStart = START.minusHours(8);
        Tag running = runningTagOwnedBy(10L, 1L, serverAnchor);
        given(loadTagPort.loadTag(10L)).willReturn(Optional.of(running));

        // Act
        timerCommandService.stopTimer(new StopTimerCommand(10L, 600L, staleClientStart, END, 1L));

        // Assert
        ArgumentCaptor<CreateRecordCommand> captor = ArgumentCaptor.forClass(CreateRecordCommand.class);
        then(createRecordUseCase).should().createRecord(captor.capture());
        assertThat(captor.getValue().startTime())
                .as("클라이언트가 보낸 stale 한 시작시각이 기록 구간이 되면 안 된다")
                .isEqualTo(serverAnchor);
        assertThat(captor.getValue().endTime()).isEqualTo(END);
    }

    @Test
    @DisplayName("[유령정지] 이미 정지된 태그에 대해 서버가 닫은 구간을 다시 정지시키면 거부하고 기록도 만들지 않는다")
    void stopTimer_rejectsRestopOfAlreadyClosedPeriod() {
        // Arrange — 다른 기기가 12:20 에 정지시켰고, 이 기기는 그보다 이른 2:13 을 시작시각으로 든다.
        ZonedDateTime alreadyStoppedAt = START;
        Tag stopped = stoppedTagWithLastStop(10L, 1L, alreadyStoppedAt);
        given(loadTagPort.loadTag(10L)).willReturn(Optional.of(stopped));

        // Act & Assert
        assertThatThrownBy(() -> timerCommandService.stopTimer(
                new StopTimerCommand(10L, 99999L, alreadyStoppedAt.minusHours(8), alreadyStoppedAt.plusHours(24), 1L)))
                .isInstanceOf(DomainException.class);

        then(createRecordUseCase).shouldHaveNoInteractions();
        then(saveTagPort).shouldHaveNoInteractions();
    }

    @Test
    @DisplayName("[오프라인] 이미 정지된 태그여도 서버가 닫은 구간 이후의 세션이면 정상 기록한다(오프라인 start 유실 방지)")
    void stopTimer_acceptsSessionAfterLastClosedPeriod_whenNotRunning() {
        // Arrange — 오프라인에서 start 가 큐에 남아 서버에 안 닿은 채, 온라인 복귀 후 stop 만 도착한 경우.
        // 서버는 이 태그를 RUNNING 으로 모르지만, 세션 구간은 마지막으로 닫힌 구간보다 뒤라 정당하다.
        ZonedDateTime lastClosed = START.minusDays(1);
        Tag stopped = stoppedTagWithLastStop(10L, 1L, lastClosed);
        given(loadTagPort.loadTag(10L)).willReturn(Optional.of(stopped));

        // Act
        timerCommandService.stopTimer(new StopTimerCommand(10L, 600L, START, END, 1L));

        // Assert — 사용자의 오프라인 세션이 조용히 사라지면 안 된다.
        ArgumentCaptor<CreateRecordCommand> captor = ArgumentCaptor.forClass(CreateRecordCommand.class);
        then(createRecordUseCase).should().createRecord(captor.capture());
        assertThat(captor.getValue().startTime()).isEqualTo(START);
        assertThat(captor.getValue().endTime()).isEqualTo(END);
        assertThat(stopped.getTimerState()).isEqualTo(TimerState.STOPPED);
    }

    @Test
    @DisplayName("[방어] RUNNING 인데 서버 시작시각이 EPOCH 로 무효면 서버 앵커를 쓰지 않고 클라이언트 값으로 기록한다")
    void stopTimer_fallsBackToClientStart_whenServerAnchorInvalid() {
        // Arrange — 정상 경로에서는 생기지 않지만, 생기면 1970년부터의 거대한 기록이 된다.
        Tag running = runningTagOwnedBy(10L, 1L,
                ZonedDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneId.systemDefault()));
        given(loadTagPort.loadTag(10L)).willReturn(Optional.of(running));

        // Act
        timerCommandService.stopTimer(new StopTimerCommand(10L, 600L, START, END, 1L));

        // Assert
        ArgumentCaptor<CreateRecordCommand> captor = ArgumentCaptor.forClass(CreateRecordCommand.class);
        then(createRecordUseCase).should().createRecord(captor.capture());
        assertThat(captor.getValue().startTime())
                .as("EPOCH 앵커로 56년짜리 기록을 만들면 안 된다")
                .isEqualTo(START);
    }

    @Test
    @DisplayName("[시계오차] 정지시각이 미래로 찍혀 있으면 그 표시를 근거로 정지를 거부하지 않는다")
    void stopTimer_doesNotRejectUsingFutureStopMark() {
        // 시계가 앞선 기기가 미래 종료시각을 보내면 latestStopTime 이 미래로 남는다.
        // 그 값을 "이미 닫힌 구간"의 근거로 쓰면, 그 태그는 실제 시각이 따라잡을 때까지
        // 정상 정지가 전부 400 으로 막히고 재전송 큐가 그걸 조용히 폐기한다.
        ZonedDateTime future = ZonedDateTime.now(SEOUL).plusDays(3);
        Tag stopped = stoppedTagWithLastStop(10L, 1L, future);
        given(loadTagPort.loadTag(10L)).willReturn(Optional.of(stopped));

        ZonedDateTime realStart = ZonedDateTime.now(SEOUL).minusMinutes(30);
        timerCommandService.stopTimer(
                new StopTimerCommand(10L, 1800L, realStart, realStart.plusMinutes(30), 1L));

        ArgumentCaptor<CreateRecordCommand> captor = ArgumentCaptor.forClass(CreateRecordCommand.class);
        then(createRecordUseCase).should().createRecord(captor.capture());
        assertThat(captor.getValue().startTime()).isEqualTo(realStart);
    }

    @Test
    @DisplayName("[기존동작] 실행 중인 태그의 정상 정지는 그대로 정지·기록된다")
    void stopTimer_normalStopStillWorks() {
        Tag running = runningTagOwnedBy(10L, 1L, START);
        given(loadTagPort.loadTag(10L)).willReturn(Optional.of(running));

        timerCommandService.stopTimer(new StopTimerCommand(10L, 600L, START, END, 1L));

        assertThat(running.getTimerState()).isEqualTo(TimerState.STOPPED);
        assertThat(running.getElapsedTime()).isEqualTo(600L);
        assertThat(running.getLatestStopTime()).isEqualTo(END);
        then(saveTagPort).should().saveTag(running);
        then(createRecordUseCase).should().createRecord(any(CreateRecordCommand.class));
    }
}
