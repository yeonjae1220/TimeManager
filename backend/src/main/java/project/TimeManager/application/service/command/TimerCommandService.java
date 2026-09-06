package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.application.dto.command.CreateRecordCommand;
import project.TimeManager.application.dto.command.ResetTimerCommand;
import project.TimeManager.application.dto.command.StartTimerCommand;
import project.TimeManager.application.dto.command.StopTimerCommand;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.port.in.record.CreateRecordUseCase;
import project.TimeManager.domain.port.in.tag.ResetTimerUseCase;
import project.TimeManager.domain.port.in.tag.StartTimerUseCase;
import project.TimeManager.domain.port.in.tag.StopTimerUseCase;
import project.TimeManager.domain.port.out.tag.LoadTagPort;
import project.TimeManager.domain.port.out.tag.SaveTagPort;
import project.TimeManager.domain.tag.model.Tag;

import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class TimerCommandService implements StartTimerUseCase, StopTimerUseCase, ResetTimerUseCase {

    private final LoadTagPort loadTagPort;
    private final SaveTagPort saveTagPort;
    private final CreateRecordUseCase createRecordUseCase;

    @Override
    public Long startTimer(StartTimerCommand command) {
        Tag tag = loadTagPort.loadTag(command.tagId())
                .orElseThrow(() -> new DomainException("Tag not found: " + command.tagId()));
        assertOwner(tag, command.memberId());

        // 이 멤버의 다른 실행 중 태그를 모두 자동 정지한다. 정상적으로는 최대 1개지만, 과거 reset
        // 결함으로 다중 RUNNING이 누적됐을 수 있어 전부 정지·기록해 서버 상태를 정리한다.
        ZonedDateTime endTime = ZonedDateTime.now(command.startTime().getZone());
        for (Tag runningTag : loadTagPort.findRunningTagsByMemberId(tag.getMemberId().value())) {
            if (!runningTag.getId().value().equals(command.tagId())) {
                log.info("Auto-stopping running tag: {}", runningTag.getId().value());
                long elapsed = Math.max(0L, ChronoUnit.SECONDS.between(runningTag.getLatestStartTime(), endTime));
                runningTag.stop(endTime, elapsed);
                saveTagPort.saveTag(runningTag);
                createRecordUseCase.createRecord(new CreateRecordCommand(runningTag.getId().value(), runningTag.getLatestStartTime(), endTime, false));
            }
        }

        tag.start(command.startTime());
        saveTagPort.saveTag(tag);
        return tag.getId().value();
    }

    @Override
    public Long stopTimer(StopTimerCommand command) {
        Tag tag = loadTagPort.loadTag(command.tagId())
                .orElseThrow(() -> new DomainException("Tag not found: " + command.tagId()));
        assertOwner(tag, command.memberId());

        ZonedDateTime recordStart = resolveRecordStart(tag, command);

        tag.stop(command.endTime(), command.elapsedTime());
        saveTagPort.saveTag(tag);
        return createRecordUseCase.createRecord(new CreateRecordCommand(command.tagId(), recordStart, command.endTime(), false));
    }

    /**
     * 이 정지가 기록할 구간의 시작시각을 정한다.
     * <p>
     * 클라이언트가 보낸 시작시각을 그대로 믿으면, 다른 기기에서 이미 정지된 세션을 옛 시작시각을
     * 든 채 남아 있던 기기가 다시 정지시킬 때 서버가 그 구간을 통째로 기록으로 만든다(실제로
     * 34시간짜리 기록이 생겼다). 그렇다고 "서버가 RUNNING 이 아니면 거부"로 막으면, 오프라인에서
     * start 가 큐에 남은 채 stop 만 먼저 도착하는 정당한 경로가 함께 죽어 사용자의 세션이 조용히
     * 사라진다(재전송 큐는 401 외 4xx 를 폐기한다). 그래서 두 경우를 구간으로 가른다.
     */
    private ZonedDateTime resolveRecordStart(Tag tag, StopTimerCommand command) {
        if (tag.isRunning()) {
            // 서버가 실행 중으로 알고 있으면 그 기준 시작시각이 정본이다 — stale 한 클라이언트 값을 덮는다.
            //
            // 다만 앵커가 이 요청의 종료시각보다 뒤면 쓸 수 없다. 기기 간 시계 오차로 충분히
            // 생기는데(앞선 시계의 A 가 시작 → 정상 시계의 B 가 정지), 그대로 쓰면 TimeRange 가
            // 역전으로 던져 트랜잭션이 통째로 롤백되고 태그가 RUNNING 으로 남아 사용자가 타이머를
            // 끌 수 없게 된다. 센티넬 앵커도 같은 이유로 못 쓴다(1970년부터의 거대한 구간).
            boolean anchorIsUsable = tag.hasStartAnchor()
                    && tag.getLatestStartTime().isBefore(command.endTime());
            return anchorIsUsable ? tag.getLatestStartTime() : command.startTime();
        }

        // 서버가 실행 중으로 모르는 정지 요청. 주장하는 세션이 이미 닫힌 구간을 침범하면 거부한다.
        // 경계가 맞닿는 경우(이어서 시작한 세션)는 침범이 아니다 — TimeRange.overlaps 와 같은 규칙.
        //
        // 단, 미래로 찍힌 정지시각은 근거로 쓰지 않는다. 시계가 앞선 기기가 미래 종료시각을 한 번
        // 보내면 그 태그는 실제 시각이 따라잡을 때까지 정상 정지가 전부 거부되고, 재전송 큐가 그
        // 4xx 를 폐기해 사용자의 세션이 조용히 사라진다. 증거가 못 미더우면 막지 않는 쪽으로 물러선다.
        boolean stopMarkIsTrustworthy = tag.hasStopMark()
                && !tag.getLatestStopTime().isAfter(ZonedDateTime.now(tag.getLatestStopTime().getZone()));

        // 침범의 정의는 "닫힌 경계를 걸치고 넘어간다"다. 경계보다 앞에서 끝나는 세션까지 막으면,
        // 기록을 지워 정지표시만 stale 하게 남은 뒤 재전송된 정당한 오프라인 세션이 함께 죽는다.
        // 유령 정지는 종료시각이 사실상 "지금"이라 반드시 경계를 넘어서므로 이 좁힘으로 놓치지 않는다.
        boolean straddlesClosedBoundary = stopMarkIsTrustworthy
                && command.startTime().isBefore(tag.getLatestStopTime())
                && command.endTime().isAfter(tag.getLatestStopTime());
        if (straddlesClosedBoundary) {
            log.warn("Rejecting stop of already-closed period: tagId={}, claimedStart={}, lastStop={}",
                    command.tagId(), command.startTime(), tag.getLatestStopTime());
            throw new DomainException("이미 정지된 세션입니다");
        }
        return command.startTime();
    }

    @Override
    public Long resetTimer(ResetTimerCommand command) {
        Tag tag = loadTagPort.loadTag(command.tagId())
                .orElseThrow(() -> new DomainException("Tag not found: " + command.tagId()));
        assertOwner(tag, command.memberId());
        tag.reset(command.elapsedTime());
        saveTagPort.saveTag(tag);
        return tag.getId().value();
    }

    private void assertOwner(Tag tag, Long memberId) {
        if (!tag.getMemberId().value().equals(memberId)) {
            throw new DomainException("접근 권한이 없습니다");
        }
    }
}
