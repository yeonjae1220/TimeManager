package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.application.dto.command.CreateTagCommand;
import project.TimeManager.application.dto.command.MoveTagCommand;
import project.TimeManager.application.dto.command.ReorderTagsCommand;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.port.in.tag.CreateTagUseCase;
import project.TimeManager.domain.port.in.tag.MoveTagUseCase;
import project.TimeManager.domain.port.in.tag.ReorderTagsUseCase;
import project.TimeManager.domain.port.out.tag.LoadTagPort;
import project.TimeManager.domain.port.out.tag.SaveTagPort;
import project.TimeManager.domain.port.out.tag.SaveTagsOrderPort;
import project.TimeManager.domain.port.out.tag.UpdateTagTimeBatchPort;
import project.TimeManager.domain.tag.model.Tag;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class TagCommandService implements CreateTagUseCase, MoveTagUseCase, ReorderTagsUseCase {

    private final LoadTagPort loadTagPort;
    private final SaveTagPort saveTagPort;
    private final UpdateTagTimeBatchPort updateTagTimeBatchPort;
    private final SaveTagsOrderPort saveTagsOrderPort;

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
        if (command.tagId().equals(command.newParentTagId())) {
            throw new DomainException("A tag cannot be moved to itself");
        }

        Tag tag = loadTagPort.loadTag(command.tagId())
                .orElseThrow(() -> new DomainException("Tag not found: " + command.tagId()));

        if (!tag.getMemberId().value().equals(command.memberId())) {
            throw new DomainException("접근 권한이 없습니다");
        }

        Tag newParent = loadTagPort.loadTag(command.newParentTagId())
                .orElseThrow(() -> new DomainException("New parent tag not found: " + command.newParentTagId()));

        Long oldParentId = tag.getParentId() != null ? tag.getParentId().value() : null;
        long tagTotalTime = tag.getTotalTime();

        if (oldParentId != null) {
            updateTagTimeBatchPort.updateTagTimeBatch(oldParentId, -tagTotalTime);
        }

        tag.moveTo(newParent.getId());
        saveTagPort.saveTag(tag);

        updateTagTimeBatchPort.updateTagTimeBatch(command.newParentTagId(), tagTotalTime);

        log.info("Tag moved: id={}, newParentId={}", command.tagId(), command.newParentTagId());
        return command.tagId();
    }

    @Override
    public void reorderTags(ReorderTagsCommand command) {
        Tag parentTag = loadTagPort.loadTag(command.parentTagId())
                .orElseThrow(() -> new DomainException("Parent tag not found: " + command.parentTagId()));
        if (!parentTag.getMemberId().value().equals(command.memberId())) {
            throw new DomainException("접근 권한이 없습니다");
        }
        saveTagsOrderPort.saveTagsOrder(command.orderedTagIds());
        log.info("Tags reordered: parentId={}, order={}", command.parentTagId(), command.orderedTagIds());
    }
}
