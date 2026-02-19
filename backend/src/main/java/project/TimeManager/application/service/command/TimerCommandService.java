package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.application.dto.command.ResetTimerCommand;
import project.TimeManager.application.dto.command.StartTimerCommand;
import project.TimeManager.application.dto.command.StopTimerCommand;
import project.TimeManager.application.port.in.tag.ResetTimerUseCase;
import project.TimeManager.application.port.in.tag.StartTimerUseCase;
import project.TimeManager.application.port.in.tag.StopTimerUseCase;
import project.TimeManager.application.port.out.tag.LoadTagPort;
import project.TimeManager.application.port.out.tag.SaveTagPort;
import project.TimeManager.adapter.out.persistence.adapter.TagPersistenceAdapter;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.domain.shared.DomainException;
import project.TimeManager.domain.tag.model.Tag;
import project.TimeManager.domain.tag.model.TimerState;

import java.time.ZonedDateTime;
import java.util.List;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class TimerCommandService implements StartTimerUseCase, StopTimerUseCase, ResetTimerUseCase {

    private final LoadTagPort loadTagPort;
    private final SaveTagPort saveTagPort;
    private final TagPersistenceAdapter tagPersistenceAdapter;
    private final RecordCommandService recordCommandService;

    @Override
    public Long startTimer(StartTimerCommand command) {
        Tag tag = loadTagPort.loadTag(command.tagId())
                .orElseThrow(() -> new DomainException("Tag not found: " + command.tagId()));

        // Stop any other running tag for this member
        List<TagJpaEntity> memberTags = tagPersistenceAdapter.loadJpaEntitiesByMemberId(
                tag.getMemberId().value());
        for (TagJpaEntity other : memberTags) {
            if (other.getTimerState() == TimerState.RUNNING && !other.getId().equals(command.tagId())) {
                log.info("Auto-stopping running tag: {}", other.getId());
                ZonedDateTime endTime = ZonedDateTime.now(command.startTime().getZone());
                recordCommandService.stopAndSaveRecord(
                        other.getId(),
                        0L,
                        other.getLatestStartTime(),
                        endTime
                );
                break;
            }
        }

        tag.start(command.startTime());
        saveTagPort.saveTag(tag);
        return tag.getId().value();
    }

    @Override
    public Long stopTimer(StopTimerCommand command) {
        return recordCommandService.stopAndSaveRecord(
                command.tagId(),
                command.elapsedTime(),
                command.startTime(),
                command.endTime()
        );
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
