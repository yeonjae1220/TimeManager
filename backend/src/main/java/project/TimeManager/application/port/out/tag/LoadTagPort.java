package project.TimeManager.application.port.out.tag;

import project.TimeManager.domain.tag.model.Tag;

import java.util.Optional;

public interface LoadTagPort {
    Optional<Tag> loadTag(Long tagId);
}
