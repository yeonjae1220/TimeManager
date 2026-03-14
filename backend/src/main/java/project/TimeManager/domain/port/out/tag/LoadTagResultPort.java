package project.TimeManager.domain.port.out.tag;

import project.TimeManager.application.dto.result.TagResult;

import java.util.Optional;

public interface LoadTagResultPort {
    Optional<TagResult> loadTagResult(Long tagId);
}
