package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.application.dto.command.CreateTagCommand;
import project.TimeManager.application.dto.command.MoveTagCommand;
import project.TimeManager.application.dto.command.RenameTagCommand;
import project.TimeManager.application.dto.command.ReorderTagsCommand;
import project.TimeManager.application.dto.command.SetDailyGoalCommand;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.exception.ResourceForbiddenException;
import project.TimeManager.domain.tag.model.TagType;

import java.util.HashSet;
import java.util.Set;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.port.in.tag.CreateTagUseCase;
import project.TimeManager.domain.port.in.tag.MoveTagUseCase;
import project.TimeManager.domain.port.in.tag.RenameTagUseCase;
import project.TimeManager.domain.port.in.tag.ReorderTagsUseCase;
import project.TimeManager.domain.port.in.tag.SetDailyGoalUseCase;
import project.TimeManager.domain.port.out.tag.LoadTagPort;
import project.TimeManager.domain.port.out.tag.SaveTagPort;
import project.TimeManager.domain.port.out.tag.SaveTagsOrderPort;
import project.TimeManager.domain.port.out.tag.UpdateTagTimeBatchPort;
import project.TimeManager.domain.tag.model.Tag;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class TagCommandService implements CreateTagUseCase, MoveTagUseCase, RenameTagUseCase, ReorderTagsUseCase,
        SetDailyGoalUseCase {

    private final LoadTagPort loadTagPort;
    private final SaveTagPort saveTagPort;
    private final UpdateTagTimeBatchPort updateTagTimeBatchPort;
    private final SaveTagsOrderPort saveTagsOrderPort;

    @Override
    public Long createTag(CreateTagCommand command) {
        loadTagPort.lockMember(command.memberId());
        Tag parent = requireOwnedTag(command.parentTagId(), command.memberId());

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
        loadTagPort.lockMember(command.memberId());
        Tag tag = requireOwnedTag(command.tagId(), command.memberId());
        Tag newParent = requireOwnedTag(command.newParentTagId(), command.memberId());
        if (command.tagId().equals(command.newParentTagId())) {
            throw new DomainException("A tag cannot be moved to itself");
        }
        if (tag.getType() != TagType.CUSTOM) {
            throw new DomainException("기본 태그는 이동할 수 없습니다");
        }
        validateParentChain(tag, newParent, command.memberId());

        Long oldParentId = tag.getParentId() != null ? tag.getParentId().value() : null;
        if (command.newParentTagId().equals(oldParentId)) return command.tagId();
        long tagTotalTime = tag.getTotalTime();

        if (oldParentId != null) {
            Tag oldParent = loadTagPort.loadTag(oldParentId).orElse(null);
            if (oldParent != null && oldParent.getMemberId().value().equals(command.memberId())) {
                updateTagTimeBatchPort.updateTagTimeBatch(oldParentId, -tagTotalTime);
            }
        }

        tag.moveTo(newParent.getId());
        saveTagPort.saveTag(tag);

        updateTagTimeBatchPort.updateTagTimeBatch(command.newParentTagId(), tagTotalTime);

        log.info("Tag moved: id={}, newParentId={}", command.tagId(), command.newParentTagId());
        return command.tagId();
    }

    @Override
    public Long renameTag(RenameTagCommand command) {
        Tag tag = loadTagPort.loadTag(command.tagId())
                .orElseThrow(() -> new DomainException("Tag not found: " + command.tagId()));

        if (!tag.getMemberId().value().equals(command.memberId())) {
            throw new DomainException("접근 권한이 없습니다");
        }

        tag.rename(command.newName());
        saveTagPort.saveTag(tag);

        log.info("Tag renamed: id={}, newName={}", command.tagId(), command.newName());
        return command.tagId();
    }

    @Override
    public Long setDailyGoal(SetDailyGoalCommand command) {
        Tag tag = loadTagPort.loadTag(command.tagId())
                .orElseThrow(() -> new DomainException("Tag not found: " + command.tagId()));

        if (!tag.getMemberId().value().equals(command.memberId())) {
            throw new DomainException("접근 권한이 없습니다");
        }

        tag.updateDailyGoalTime(command.dailyGoalTime());
        saveTagPort.saveTag(tag);

        log.info("Tag daily goal updated: id={}, dailyGoalTime={}", command.tagId(), command.dailyGoalTime());
        return command.tagId();
    }

    @Override
    public void reorderTags(ReorderTagsCommand command) {
        loadTagPort.lockMember(command.memberId());
        requireOwnedTag(command.parentTagId(), command.memberId());
        Set<Long> unique = new HashSet<>();
        for (Long id : command.orderedTagIds()) {
            if (id == null || !unique.add(id)) {
                throw new DomainException("정렬 목록의 태그는 중복되거나 비어 있을 수 없습니다");
            }
            Tag child = requireOwnedTag(id, command.memberId());
            if (child.getType() != TagType.CUSTOM || child.getParentId() == null
                    || !child.getParentId().value().equals(command.parentTagId())) {
                throw new DomainException("같은 부모 아래의 태그만 정렬할 수 있습니다");
            }
        }
        saveTagsOrderPort.saveTagsOrder(command.orderedTagIds());
    }

    private Tag requireOwnedTag(Long id, Long memberId) {
        return loadTagPort.loadTag(id)
                .filter(tag -> tag.getMemberId().value().equals(memberId))
                .orElseThrow(ResourceForbiddenException::new);
    }

    private void validateParentChain(Tag moving, Tag parent, Long memberId) {
        Set<Long> visited = new HashSet<>();
        Tag current = parent;
        while (current != null) {
            Long id = current.getId().value();
            if (id.equals(moving.getId().value()) || !visited.add(id)) {
                throw new DomainException("태그 계층에 순환을 만들 수 없습니다");
            }
            current = current.getParentId() == null
                    ? null : requireOwnedTag(current.getParentId().value(), memberId);
        }
    }
}
