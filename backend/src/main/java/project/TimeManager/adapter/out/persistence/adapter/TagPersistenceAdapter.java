package project.TimeManager.adapter.out.persistence.adapter;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import project.TimeManager.adapter.out.persistence.entity.MemberJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.adapter.out.persistence.mapper.TagMapper;
import project.TimeManager.adapter.out.persistence.repository.MemberJpaRepository;
import project.TimeManager.adapter.out.persistence.repository.TagJpaRepository;
import project.TimeManager.application.dto.result.TagResult;
import project.TimeManager.domain.port.out.tag.LoadTagPort;
import project.TimeManager.domain.port.out.tag.LoadTagResultPort;
import project.TimeManager.domain.port.out.tag.LoadTagsByMemberPort;
import project.TimeManager.domain.port.out.tag.SaveTagPort;
import project.TimeManager.domain.port.out.tag.UpdateTagTimeBatchPort;
import project.TimeManager.domain.tag.model.Tag;
import project.TimeManager.domain.tag.model.TimerState;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class TagPersistenceAdapter implements LoadTagPort, SaveTagPort, LoadTagsByMemberPort, UpdateTagTimeBatchPort, LoadTagResultPort {

    private final TagJpaRepository tagJpaRepository;
    private final MemberJpaRepository memberJpaRepository;
    private final TagMapper tagMapper;

    @Override
    public Optional<Tag> loadTag(Long tagId) {
        return tagJpaRepository.findById(tagId)
                .map(tagMapper::toDomain);
    }

    @Override
    public Long saveTag(Tag domain) {
        if (domain.getId() != null) {
            TagJpaEntity entity = tagJpaRepository.findById(domain.getId().value())
                    .orElseThrow(() -> new EntityNotFoundException("Tag not found: " + domain.getId().value()));
            tagMapper.updateJpaEntity(entity, domain);
            if (domain.getParentId() != null) {
                TagJpaEntity parent = tagJpaRepository.getReferenceById(domain.getParentId().value());
                entity.setParent(parent);
            }
            return tagJpaRepository.save(entity).getId();
        } else {
            MemberJpaEntity member = memberJpaRepository.getReferenceById(domain.getMemberId().value());
            TagJpaEntity parent = domain.getParentId() != null
                    ? tagJpaRepository.getReferenceById(domain.getParentId().value())
                    : null;
            TagJpaEntity entity = tagMapper.toNewJpaEntity(domain, member, parent);
            return tagJpaRepository.save(entity).getId();
        }
    }

    @Override
    public List<TagResult> loadTagsByMemberId(Long memberId) {
        return tagJpaRepository.findTagsByMemberId(memberId).stream()
                .map(tagMapper::toResult)
                .collect(Collectors.toList());
    }

    @Override
    public void updateTagTimeBatch(Long startTagId, Long deltaTime) {
        List<Long> ancestorIds = tagJpaRepository.findAncestorIds(startTagId);
        if (!ancestorIds.isEmpty()) {
            log.info("updateTagTimeBatch: tagIds={}, deltaTime={}", ancestorIds, deltaTime);
            tagJpaRepository.updateTagTimesBatch(ancestorIds, deltaTime);
        }
    }

    @Override
    public Optional<Tag> findRunningTagByMemberId(Long memberId) {
        return tagJpaRepository.findRunningByMemberId(memberId, TimerState.RUNNING)
                .map(tagMapper::toDomain);
    }

    @Override
    public Optional<TagResult> loadTagResult(Long tagId) {
        return tagJpaRepository.findById(tagId)
                .map(tagMapper::toResult);
    }
}
