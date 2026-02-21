package project.TimeManager.adapter.in.web;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import project.TimeManager.adapter.in.web.dto.request.PushSubscribeRequest;
import project.TimeManager.adapter.in.web.dto.request.PushUnsubscribeRequest;
import project.TimeManager.application.port.in.notification.SavePushSubscriptionUseCase;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/push")
public class NotificationApiController {

    private final SavePushSubscriptionUseCase savePushSubscriptionUseCase;

    /** POST /api/push/subscribe/{memberId} — 구독 등록 */
    @PostMapping("/subscribe/{memberId}")
    public ResponseEntity<Void> subscribe(
            @PathVariable Long memberId,
            @RequestBody PushSubscribeRequest request) {
        savePushSubscriptionUseCase.saveSubscription(memberId, request);
        return ResponseEntity.ok().build();
    }

    /** DELETE /api/push/unsubscribe/{memberId} — 구독 해제 */
    @DeleteMapping("/unsubscribe/{memberId}")
    public ResponseEntity<Void> unsubscribe(
            @PathVariable Long memberId,
            @RequestBody PushUnsubscribeRequest request) {
        savePushSubscriptionUseCase.deleteSubscription(memberId, request.endpoint());
        return ResponseEntity.ok().build();
    }
}
