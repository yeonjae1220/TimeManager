package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.adapter.out.persistence.adapter.TagPersistenceAdapter;
import project.TimeManager.application.dto.command.CreateTagCommand;
import project.TimeManager.application.dto.command.MoveTagCommand;
import project.TimeManager.application.port.in.tag.CreateTagUseCase;
import project.TimeManager.application.port.in.tag.MoveTagUseCase;
import project.TimeManager.application.port.out.tag.LoadTagPort;
import project.TimeManager.application.port.out.tag.SaveTagPort;
import project.TimeManager.application.port.out.tag.UpdateTagTimeBatchPort;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.shared.DomainException;
import project.TimeManager.domain.tag.model.Tag;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class TagCommandService implements CreateTagUseCase, MoveTagUseCase {

    private final LoadTagPort loadTagPort;
    private final SaveTagPort saveTagPort;
    private final UpdateTagTimeBatchPort updateTagTimeBatchPort;
    private final TagPersistenceAdapter tagPersistenceAdapter;

    @Override
    public Long createTag(CreateTagCommand command) {
        Tag parent = loadTagPort.loadTag(command.parentTagId())
                .orElseThrow(() -> new DomainException("Parent tag not found: " + command.parentTagId()));

        Tag newTag = Tag.createCustomTag(
                command.tagName(),
                MemberId.of(command.memberId()),
                parent.getId()
        );

        Long id = saveTagPort.saveTag(newTag);
        log.info("Tag created: id={}, name={}", id, command.tagName());
        return id;
    }

    @Override
    public Long moveTag(MoveTagCommand command) {
        // 비즈니스 규칙: 태그를 자기 자신으로 이동할 수 없다
        if (command.tagId().equals(command.newParentTagId())) {
            throw new IllegalArgumentException("태그를 자기 자신으로 이동할 수 없습니다");
        }

        Tag tag = loadTagPort.loadTag(command.tagId())
                .orElseThrow(() -> new DomainException("Tag not found: " + command.tagId()));

        Tag newParent = loadTagPort.loadTag(command.newParentTagId())
                .orElseThrow(() -> new DomainException("New parent tag not found: " + command.newParentTagId()));

        Long oldParentId = tag.getParentId() != null ? tag.getParentId().value() : null;
        long tagTotalTime = tag.getTotalTime();

        // 기존 부모 계층에서 시간 차감
        if (oldParentId != null) {
            updateTagTimeBatchPort.updateTagTimeBatch(oldParentId, -tagTotalTime);
        }

        // 부모 참조 변경
        tag.moveTo(newParent.getId());
        saveTagPort.saveTag(tag);

        // 새 부모 계층에 시간 추가
        updateTagTimeBatchPort.updateTagTimeBatch(command.newParentTagId(), tagTotalTime);

        log.info("Tag moved: id={}, newParentId={}", command.tagId(), command.newParentTagId());
        return command.tagId();
    }
}
