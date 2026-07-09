package project.TimeManager.domain.port.out.tag;

import project.TimeManager.domain.tag.model.Tag;

import java.util.List;
import java.util.Optional;

public interface LoadTagPort {
    Optional<Tag> loadTag(Long tagId);
    // 멤버당 실행 중 태그는 정상적으로 최대 1개이나, 과거 reset 결함/동시성으로 다중 RUNNING이
    // 누적될 수 있어 List로 조회한다(Optional 단건 조회는 NonUniqueResult로 startTimer 전체를 막았음).
    List<Tag> findRunningTagsByMemberId(Long memberId);
    List<Tag> findAllRunningTags();
}
