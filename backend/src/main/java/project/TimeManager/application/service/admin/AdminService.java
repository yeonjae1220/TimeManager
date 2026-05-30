package project.TimeManager.application.service.admin;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.application.service.notification.PushSender;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.member.model.MemberRole;
import project.TimeManager.domain.port.in.member.DeleteMemberUseCase;
import project.TimeManager.domain.port.out.member.LoadMemberPort;
import project.TimeManager.domain.port.out.member.UpdateMemberPort;
import project.TimeManager.domain.port.out.notification.LoadPushSubscriptionsPort;
import project.TimeManager.domain.port.out.tag.LoadTagPort;
import project.TimeManager.domain.port.out.tag.SaveTagPort;
import project.TimeManager.domain.tag.model.Tag;

import java.time.ZonedDateTime;
import java.util.List;

@Service
@Transactional
@RequiredArgsConstructor
public class AdminService {

    private final LoadMemberPort loadMemberPort;
    private final UpdateMemberPort updateMemberPort;
    private final DeleteMemberUseCase deleteMemberUseCase;
    private final LoadTagPort loadTagPort;
    private final SaveTagPort saveTagPort;
    private final LoadPushSubscriptionsPort loadPushSubscriptionsPort;
    private final PushSender pushSender;

    @Transactional(readOnly = true)
    public Page<Member> getMembers(Pageable pageable) {
        return loadMemberPort.findAll(pageable);
    }

    @Transactional(readOnly = true)
    public List<Member> getAllMembers() {
        return loadMemberPort.loadAllMembers();
    }

    public void updateMemberRole(Long memberId, MemberRole role) {
        updateMemberPort.updateMemberRole(memberId, role);
    }

    public void deleteMember(Long memberId) {
        deleteMemberUseCase.deleteMember(memberId);
    }

    @Transactional(readOnly = true)
    public long getTotalMemberCount() {
        return loadMemberPort.count();
    }

    @Transactional(readOnly = true)
    public List<Tag> getStalledRunningTags(int thresholdHours) {
        ZonedDateTime threshold = ZonedDateTime.now().minusHours(thresholdHours);
        return loadTagPort.findAllRunningTags().stream()
                .filter(t -> t.getLatestStartTime().isBefore(threshold))
                .toList();
    }

    public void forceStopTimer(Long tagId) {
        Tag tag = loadTagPort.loadTag(tagId)
                .orElseThrow(() -> new IllegalArgumentException("태그를 찾을 수 없습니다: " + tagId));
        tag.stop(ZonedDateTime.now(), 0L);
        saveTagPort.saveTag(tag);
    }

    @Transactional(readOnly = true)
    public long getPushSubscriberCount() {
        return loadPushSubscriptionsPort.loadAllSubscriptions().size();
    }

    public void sendPushToAll(String title, String body) {
        pushSender.sendToAll(title, body);
    }

    public void sendPushToMember(Long memberId, String title, String body) {
        pushSender.sendToMember(memberId, title, body);
    }
}
