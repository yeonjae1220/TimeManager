package project.TimeManager.domain.port.out.tag;

import project.TimeManager.application.dto.result.TagResult;

import java.util.List;

public interface LoadTagsByMemberPort {
    List<TagResult> loadTagsByMemberId(Long memberId);
}
