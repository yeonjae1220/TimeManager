package project.TimeManager.application.port.out.tag;

import project.TimeManager.application.dto.result.TagResult;
import project.TimeManager.domain.tag.model.Tag;

import java.util.Optional;

public interface LoadTagPort {
    Optional<Tag> loadTag(Long tagId);
    Optional<Tag> findRunningTagByMemberId(Long memberId);
    Optional<TagResult> loadTagResult(Long tagId);
}
