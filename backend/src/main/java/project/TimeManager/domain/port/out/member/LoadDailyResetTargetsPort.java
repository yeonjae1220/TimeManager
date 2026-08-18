package project.TimeManager.domain.port.out.member;

import java.util.List;

public interface LoadDailyResetTargetsPort {

    /** 삭제되지 않은 전 회원의 리셋 판정에 필요한 값만 읽는다. */
    List<DailyResetTarget> loadDailyResetTargets();
}
