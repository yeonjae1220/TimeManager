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
        tag.stop(command.endTime(), command.elapsedTime());
        saveTagPort.saveTag(tag);
        return createRecordUseCase.createRecord(new CreateRecordCommand(command.tagId(), command.startTime(), command.endTime(), false));
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
