package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.application.port.in.member.CreateMemberUseCase;
import project.TimeManager.application.port.out.member.SaveMemberPort;
import project.TimeManager.application.port.out.tag.SaveTagPort;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.tag.model.Tag;
import project.TimeManager.domain.tag.model.TagId;

@Service
@Transactional
@RequiredArgsConstructor
public class MemberCommandService implements CreateMemberUseCase {

    private final SaveMemberPort saveMemberPort;
    private final SaveTagPort saveTagPort;

    @Override
    public Long createMember(String name) {
        Member member = Member.create(name);
        Long memberId = saveMemberPort.saveMember(member);

        // Create default root tag
        Tag rootTag = Tag.createRootTag("root", MemberId.of(memberId));
        Long rootTagId = saveTagPort.saveTag(rootTag);

        // Create default discarded tag (child of root)
        Tag discardedTag = Tag.createDiscardedTag("discarded", MemberId.of(memberId), TagId.of(rootTagId));
        saveTagPort.saveTag(discardedTag);

        return memberId;
    }
}
