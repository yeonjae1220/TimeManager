package project.TimeManager.domain.port.out.tag;

import java.util.List;

public interface SaveTagsOrderPort {
    void saveTagsOrder(List<Long> orderedTagIds);
}
