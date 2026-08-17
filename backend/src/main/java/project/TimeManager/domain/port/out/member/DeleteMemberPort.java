package project.TimeManager.domain.port.out.member;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 계정 삭제 수명주기. 삭제는 두 단계다 — 요청 즉시 '삭제 상태'로 두고(soft),
 * 유예가 지나면 물리적으로 지운다(purge).
 */
public interface DeleteMemberPort {

    /**
     * 회원을 삭제 상태로 표시하고 이메일을 봉인한다.
     * 봉인하는 이유: email 에 unique 제약이 있어 그대로 두면 같은 주소로 영영
     * 재가입할 수 없다.
     *
     * @return 이번 호출로 상태가 바뀌었으면 true. 없는 회원이거나 이미 삭제 상태면 false
     *         (재시도·중복 요청이 예외가 되지 않도록).
     */
    boolean softDeleteMember(Long memberId);

    /** 유예가 지나 물리 삭제 대상이 된 회원. */
    List<Long> findPurgeableMemberIds(LocalDateTime deletedBefore);

    /** 물리 삭제. 호출 전에 이 회원의 기록이 먼저 지워져 있어야 한다(외래키). */
    void purgeMember(Long memberId);
}
