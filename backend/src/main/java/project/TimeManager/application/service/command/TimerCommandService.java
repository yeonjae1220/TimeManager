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

        // Stop any other running tag for this member
        loadTagPort.findRunningTagByMemberId(tag.getMemberId().value()).ifPresent(runningTag -> {
            if (!runningTag.getId().value().equals(command.tagId())) {
                log.info("Auto-stopping running tag: {}", runningTag.getId().value());
                ZonedDateTime endTime = ZonedDateTime.now(command.startTime().getZone());
                long elapsed = Math.max(0L, ChronoUnit.SECONDS.between(runningTag.getLatestStartTime(), endTime));
                runningTag.stop(endTime, elapsed);
                saveTagPort.saveTag(runningTag);
                createRecordUseCase.createRecord(new CreateRecordCommand(runningTag.getId().value(), runningTag.getLatestStartTime(), endTime));
            }
        });

        tag.start(command.startTime());
        saveTagPort.saveTag(tag);
        return tag.getId().value();
    }

    @Override
    public Long stopTimer(StopTimerCommand command) {
        Tag tag = loadTagPort.loadTag(command.tagId())
                .orElseThrow(() -> new DomainException("Tag not found: " + command.tagId()));
        tag.stop(command.endTime(), command.elapsedTime());
        saveTagPort.saveTag(tag);
        return createRecordUseCase.createRecord(new CreateRecordCommand(command.tagId(), command.startTime(), command.endTime()));
    }

    @Override
    public Long resetTimer(ResetTimerCommand command) {
        Tag tag = loadTagPort.loadTag(command.tagId())
                .orElseThrow(() -> new DomainException("Tag not found: " + command.tagId()));
        tag.reset(command.elapsedTime());
        saveTagPort.saveTag(tag);
        return tag.getId().value();
    }
}
