package project.TimeManager.domain.port.out.tag;

import project.TimeManager.domain.tag.model.Tag;

public interface SaveTagPort {
    Long saveTag(Tag tag);
}
