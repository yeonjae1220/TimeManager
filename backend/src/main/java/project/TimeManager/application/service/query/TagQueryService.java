package project.TimeManager.application.service.query;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.application.dto.result.TagResult;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.port.in.tag.GetTagListQuery;
import project.TimeManager.domain.port.in.tag.GetTagQuery;
import project.TimeManager.domain.port.out.tag.LoadTagResultPort;
import project.TimeManager.domain.port.out.tag.LoadTagsByMemberPort;

import java.util.List;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class TagQueryService implements GetTagQuery, GetTagListQuery {

    private final LoadTagsByMemberPort loadTagsByMemberPort;
    private final LoadTagResultPort loadTagResultPort;

    @Override
    public TagResult getTag(Long tagId) {
        return loadTagResultPort.loadTagResult(tagId)
                .orElseThrow(() -> new DomainException("Tag not found: " + tagId));
    }

    @Override
    public List<TagResult> getTagListByMemberId(Long memberId) {
        return loadTagsByMemberPort.loadTagsByMemberId(memberId);
    }
}
