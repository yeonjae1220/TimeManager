package project.TimeManager.application.port.in.tag;

import project.TimeManager.application.dto.result.TagResult;

import java.util.List;

public interface GetTagListQuery {
    List<TagResult> getTagListByMemberId(Long memberId);
}
