package project.TimeManager.repository;

import project.TimeManager.dto.TagDto;
import project.TimeManager.entity.Records;
import project.TimeManager.entity.Tag;

import java.util.List;

public interface TagRepositoryCustom {
    //    List<Tag> findFirstChild(Long parentId);
//
//    public List<Tag> findAllDescendantsInTree(Long parentId);
    public List<Records> findRecordsByTag(Tag tag);

    public void updateTagTimesBatch(List<Long> tagIds, Long deltaTime);

//    public void updateTagParent(Tag currentTag, Tag ParentTag, Tag newParentTag);

    public List<TagDto> findTagListDtoByMemberId(Long memberId);

    public TagDto findOneTagDtoById(Long tagId);
}
