package project.TimeManager.domain.port.out.tag;

import project.TimeManager.domain.tag.model.Tag;

import java.util.Optional;

public interface LoadTagPort {
    Optional<Tag> loadTag(Long tagId);
    Optional<Tag> findRunningTagByMemberId(Long memberId);
}
