package project.TimeManager.application.service.query;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.application.dto.result.TagResult;
import project.TimeManager.application.port.in.tag.GetTagListQuery;
import project.TimeManager.application.port.in.tag.GetTagQuery;
import project.TimeManager.application.port.out.tag.LoadTagsByMemberPort;
import project.TimeManager.adapter.out.persistence.adapter.TagPersistenceAdapter;
import project.TimeManager.adapter.out.persistence.mapper.TagMapper;
import project.TimeManager.domain.shared.DomainException;

import java.util.List;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class TagQueryService implements GetTagQuery, GetTagListQuery {

    private final LoadTagsByMemberPort loadTagsByMemberPort;
    private final TagPersistenceAdapter tagPersistenceAdapter;
    private final TagMapper tagMapper;

    @Override
    public TagResult getTag(Long tagId) {
        return tagMapper.toResult(
                tagPersistenceAdapter.loadJpaEntity(tagId)
        );
    }

    @Override
    public List<TagResult> getTagListByMemberId(Long memberId) {
        return loadTagsByMemberPort.loadTagsByMemberId(memberId);
    }
}
