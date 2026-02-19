package project.TimeManager.adapter.out.persistence.repository;

import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;

import java.util.List;

public interface TagJpaRepositoryCustom {
    List<TagJpaEntity> findTagsByMemberId(Long memberId);

    void updateTagTimesBatch(List<Long> tagIds, Long deltaTime);
}
