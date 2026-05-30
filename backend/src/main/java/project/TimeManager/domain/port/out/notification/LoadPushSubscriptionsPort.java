package project.TimeManager.domain.port.out.notification;

import project.TimeManager.domain.notification.model.PushSubscription;

import java.util.List;

public interface LoadPushSubscriptionsPort {
    List<PushSubscription> loadAllSubscriptions();
    List<PushSubscription> loadByMemberId(Long memberId);
    // HIGH-3 fix: 전체 로드 없이 COUNT 쿼리로 구독자 수 조회
    long countAll();
}
