package project.TimeManager.domain.port.out.tag;

import java.time.ZonedDateTime;

public interface ResetTagDailyTimesPort {
    void resetDailyTimesByMemberId(Long memberId);
    void rebuildDailyTotals(Long memberId, ZonedDateTime start, ZonedDateTime end);
}
