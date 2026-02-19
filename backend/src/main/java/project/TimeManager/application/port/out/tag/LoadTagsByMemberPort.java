package project.TimeManager.application.port.out.tag;

import project.TimeManager.application.dto.result.TagResult;

import java.util.List;

public interface LoadTagsByMemberPort {
    List<TagResult> loadTagsByMemberId(Long memberId);
}
