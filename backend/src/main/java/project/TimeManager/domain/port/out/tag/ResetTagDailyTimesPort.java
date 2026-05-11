package project.TimeManager.domain.port.out.tag;

public interface ResetTagDailyTimesPort {
    void resetDailyTimesByMemberId(Long memberId);
}
