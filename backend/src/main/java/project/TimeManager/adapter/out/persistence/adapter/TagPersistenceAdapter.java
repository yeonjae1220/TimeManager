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
import project.TimeManager.domain.port.out.tag.SaveTagsOrderPort;
import project.TimeManager.domain.port.out.tag.UpdateTagTimeBatchPort;
import project.TimeManager.domain.tag.model.Tag;
import project.TimeManager.domain.tag.model.TimerState;

import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class TagPersistenceAdapter implements LoadTagPort, SaveTagPort, LoadTagsByMemberPort, UpdateTagTimeBatchPort, LoadTagResultPort, SaveTagsOrderPort {

    private final TagJpaRepository tagJpaRepository;
    private final MemberJpaRepository memberJpaRepository;
    private final TagMapper tagMapper;
    private final EntityManager em;

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
            Long oldParentId = entity.getParentId();
            tagMapper.updateJpaEntity(entity, domain);
            if (domain.getParentId() != null) {
                Long newParentId = domain.getParentId().value();
                entity.setParent(tagJpaRepository.getReferenceById(newParentId));
                if (!newParentId.equals(oldParentId)) {
                    entity.setDisplayOrder(tagJpaRepository.countByParent_Id(newParentId));
                }
            }
            return tagJpaRepository.save(entity).getId();
        } else {
            MemberJpaEntity member = memberJpaRepository.getReferenceById(domain.getMemberId().value());
            TagJpaEntity parent = domain.getParentId() != null
                    ? tagJpaRepository.getReferenceById(domain.getParentId().value())
                    : null;
            TagJpaEntity entity = tagMapper.toNewJpaEntity(domain, member, parent);
            int order = (domain.getParentId() != null)
                    ? tagJpaRepository.countByParent_Id(domain.getParentId().value())
                    : 0;
            entity.setDisplayOrder(order);
            return tagJpaRepository.save(entity).getId();
        }
    }

    @Override
    public void saveTagsOrder(List<Long> orderedTagIds) {
        for (int i = 0; i < orderedTagIds.size(); i++) {
            tagJpaRepository.updateDisplayOrder(orderedTagIds.get(i), i);
        }
        em.flush();
        em.clear();
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
