package project.TimeManager.domain.port.in.member;

public interface PurgeDeletedMembersUseCase {

    /**
     * 유예가 지난 삭제 계정을 물리적으로 지운다.
     *
     * @return 지워진 회원 수
     */
    int purgeExpired();
}
