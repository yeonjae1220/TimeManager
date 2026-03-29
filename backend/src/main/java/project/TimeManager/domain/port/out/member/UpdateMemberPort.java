package project.TimeManager.domain.port.out.member;

public interface UpdateMemberPort {
    /**
     * 회원 정보를 부분 업데이트합니다.
     * null 파라미터는 해당 필드를 변경하지 않습니다.
     */
    void updateMember(Long memberId, String newName, String newHashedPassword);
}
