package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.port.out.member.InitializeMemberTagsPort;
import project.TimeManager.domain.port.out.tag.SaveTagPort;
import project.TimeManager.domain.tag.model.Tag;
import project.TimeManager.domain.tag.model.TagId;

@Service
@Transactional
@RequiredArgsConstructor
public class MemberTagInitializerService implements InitializeMemberTagsPort {

    private static final String ROOT_TAG_NAME = "root";
    private static final String DISCARDED_TAG_NAME = "discarded";

    private final SaveTagPort saveTagPort;

    @Override
    public void initializeDefaultTags(MemberId memberId) {
        Tag rootTag = Tag.createRootTag(ROOT_TAG_NAME, memberId);
        Long rootTagId = saveTagPort.saveTag(rootTag);

        Tag discardedTag = Tag.createDiscardedTag(DISCARDED_TAG_NAME, memberId, TagId.of(rootTagId));
        saveTagPort.saveTag(discardedTag);
    }
}
