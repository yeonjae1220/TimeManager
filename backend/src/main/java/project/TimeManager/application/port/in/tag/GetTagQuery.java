package project.TimeManager.application.port.in.tag;

import project.TimeManager.application.dto.result.TagResult;

public interface GetTagQuery {
    TagResult getTag(Long tagId);
}
