package project.TimeManager.domain.port.in.tag;

public interface ReconcileRunningTimersUseCase {

    /**
     * 멤버의 실행 중(RUNNING) 태그가 2개 이상이면(동시 start 레이스 등의 아티팩트) 가장 최근에
     * 시작된 태그만 남기고 나머지를 정지시켜 "멤버당 RUNNING 최대 1개" 불변식으로 수렴시킨다.
     * <p>
     * 정상 상태(RUNNING 0·1개)에서는 아무 쓰기도 하지 않는다. 읽기 경로(태그 목록·상세 조회)에서
     * 호출해, 한 기기의 조작이 다른 기기에 다중 러닝으로 보이던 표시 불일치를 서버 권위 상태 수준에서
     * 치유한다(클라이언트 캐시 마스킹이 아니라 실제 정지).
     */
    void reconcile(Long memberId);
}
