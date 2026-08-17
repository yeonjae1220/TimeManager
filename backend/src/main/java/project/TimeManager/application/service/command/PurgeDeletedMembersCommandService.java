package project.TimeManager.application.service.command;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.domain.port.in.member.PurgeDeletedMembersUseCase;
import project.TimeManager.domain.port.out.member.DeleteMemberPort;
import project.TimeManager.domain.port.out.record.DeleteRecordsByMemberPort;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@Transactional
public class PurgeDeletedMembersCommandService implements PurgeDeletedMembersUseCase {

    private final DeleteMemberPort deleteMemberPort;
    private final DeleteRecordsByMemberPort deleteRecordsByMemberPort;
    private final int graceDays;

    public PurgeDeletedMembersCommandService(
            DeleteMemberPort deleteMemberPort,
            DeleteRecordsByMemberPort deleteRecordsByMemberPort,
            @Value("${member.deletion.grace-days:30}") int graceDays) {
        this.deleteMemberPort = deleteMemberPort;
        this.deleteRecordsByMemberPort = deleteRecordsByMemberPort;
        this.graceDays = graceDays;
    }

    /**
     * 삭제 순서가 곧 정확성이다. 회원 → 태그는 JPA cascade 로 지워지지만
     * 태그 → 기록에는 cascade 가 없어(그래야 기록 단건 삭제가 태그를 건드리지 않는다)
     * 기록을 먼저 지우지 않으면 record.tag_id 외래키 제약으로 삭제 전체가 실패한다.
     */
    @Override
    public int purgeExpired() {
        LocalDateTime threshold = LocalDateTime.now().minusDays(graceDays);
        List<Long> ids = deleteMemberPort.findPurgeableMemberIds(threshold);
        if (ids.isEmpty()) return 0;

        for (Long memberId : ids) {
            int records = deleteRecordsByMemberPort.deleteByMemberId(memberId);
            deleteMemberPort.purgeMember(memberId);
            log.info("purge: memberId={} removed ({} record(s))", memberId, records);
        }
        log.info("purge: {} member(s) removed (deleted before {})", ids.size(), threshold);
        return ids.size();
    }
}
