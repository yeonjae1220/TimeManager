package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.domain.port.out.member.DeleteMemberPort;
import project.TimeManager.domain.port.out.record.DeleteRecordsByMemberPort;

/**
 * 회원 한 명의 물리 삭제를 <b>독립 트랜잭션</b>으로 수행한다.
 *
 * <p>별도 빈으로 분리한 이유는 트랜잭션 경계 때문이다. 같은 클래스 안의 메서드를 호출하면
 * 프록시를 거치지 않아 {@code @Transactional} 이 걸리지 않으므로, 배치 루프와 회원 단위
 * 작업은 서로 다른 빈에 있어야 한다.
 *
 * <p>경계를 회원 단위로 내리는 것이 곧 정확성이다 — 루프 전체가 한 트랜잭션이면 한 명의
 * 삭제 실패가 그날 대상 <b>전원</b>을 롤백시키고, 원인이 사라지지 않는 한 매일 같은 지점에서
 * 막혀 유예가 지난 계정이 영영 안 지워진다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MemberPurger {

    private final DeleteMemberPort deleteMemberPort;
    private final DeleteRecordsByMemberPort deleteRecordsByMemberPort;

    /**
     * 삭제 순서가 곧 정확성이다. 회원 → 태그는 JPA cascade 로 지워지지만
     * 태그 → 기록에는 cascade 가 없어(그래야 기록 단건 삭제가 태그를 건드리지 않는다)
     * 기록을 먼저 지우지 않으면 record.tag_id 외래키 제약으로 삭제 전체가 실패한다.
     */
    @Transactional
    public void purgeOne(Long memberId) {
        int records = deleteRecordsByMemberPort.deleteByMemberId(memberId);
        deleteMemberPort.purgeMember(memberId);
        log.info("purge: memberId={} removed ({} record(s))", memberId, records);
    }
}
