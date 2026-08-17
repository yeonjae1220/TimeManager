package project.TimeManager.application.service.command;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import project.TimeManager.domain.port.in.member.PurgeDeletedMembersUseCase;
import project.TimeManager.domain.port.out.member.DeleteMemberPort;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 유예가 끝난 삭제 계정을 물리적으로 지운다.
 *
 * <p>이 클래스에는 {@code @Transactional} 이 없다 — 의도적이다. 실제 삭제는 회원 단위로
 * {@link MemberPurger} 의 독립 트랜잭션에서 일어나고, 여기서는 실패를 <b>격리</b>해
 * 한 명이 막혀도 나머지가 지워지게 한다.
 */
@Slf4j
@Service
public class PurgeDeletedMembersCommandService implements PurgeDeletedMembersUseCase {

    private final DeleteMemberPort deleteMemberPort;
    private final MemberPurger memberPurger;
    private final int graceDays;

    public PurgeDeletedMembersCommandService(
            DeleteMemberPort deleteMemberPort,
            MemberPurger memberPurger,
            @Value("${member.deletion.grace-days:30}") int graceDays) {
        this.deleteMemberPort = deleteMemberPort;
        this.memberPurger = memberPurger;
        this.graceDays = graceDays;
    }

    @Override
    public int purgeExpired() {
        LocalDateTime threshold = LocalDateTime.now().minusDays(graceDays);
        // 단건 조회라 별도 트랜잭션 경계가 필요 없다(리포지토리 메서드가 자체 트랜잭션을 연다).
        // 여기에 @Transactional 을 붙인 메서드를 두고 자기호출하면 프록시를 안 거쳐 무효다.
        List<Long> ids = deleteMemberPort.findPurgeableMemberIds(threshold);
        if (ids.isEmpty()) return 0;

        int purged = 0;
        int failed = 0;
        for (Long memberId : ids) {
            try {
                memberPurger.purgeOne(memberId);
                purged++;
            } catch (Exception e) {
                // 이 회원만 롤백된다. 다음 회원은 새 트랜잭션에서 계속 진행한다.
                // 원인이 사라지지 않으면 매일 같은 memberId 로 이 로그가 반복되므로,
                // 로그를 memberId 로 검색하면 정체된 계정을 바로 찾을 수 있다.
                failed++;
                log.error("purge: memberId={} FAILED — 다음 실행에서 재시도한다", memberId, e);
            }
        }

        if (failed > 0) {
            log.error("purge: {} 명 삭제, {} 명 실패 (deleted before {}) — "
                    + "실패가 계속되면 /privacy 의 '{}일 뒤 영구 삭제' 약속이 깨진다",
                    purged, failed, threshold, graceDays);
        } else {
            log.info("purge: {} member(s) removed (deleted before {})", purged, threshold);
        }
        return purged;
    }
}
