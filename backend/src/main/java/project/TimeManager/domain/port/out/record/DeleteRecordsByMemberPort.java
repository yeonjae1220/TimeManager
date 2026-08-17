package project.TimeManager.domain.port.out.record;

public interface DeleteRecordsByMemberPort {

    /**
     * 해당 회원의 모든 태그에 달린 기록을 지운다. 계정 삭제 전에 호출해야 한다 —
     * record.tag_id 외래키 때문에 기록이 남아 있으면 태그 삭제가 제약 위반으로 실패한다.
     *
     * @return 지워진 기록 수
     */
    int deleteByMemberId(Long memberId);
}
