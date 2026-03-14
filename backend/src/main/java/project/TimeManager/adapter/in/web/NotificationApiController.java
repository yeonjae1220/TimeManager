package project.TimeManager.adapter.in.web;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import project.TimeManager.adapter.in.web.dto.request.PushSubscribeRequest;
import project.TimeManager.adapter.in.web.dto.request.PushUnsubscribeRequest;
import project.TimeManager.domain.port.in.notification.SavePushSubscriptionUseCase;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/push/subscriptions")
public class NotificationApiController {

    private final SavePushSubscriptionUseCase savePushSubscriptionUseCase;

    @PostMapping("/{memberId}")
    public ResponseEntity<Void> subscribe(
            @PathVariable Long memberId,
            @Valid @RequestBody PushSubscribeRequest request) {
        savePushSubscriptionUseCase.saveSubscription(memberId, request);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{memberId}")
    public ResponseEntity<Void> unsubscribe(
            @PathVariable Long memberId,
            @RequestBody PushUnsubscribeRequest request) {
        savePushSubscriptionUseCase.deleteSubscription(memberId, request.endpoint());
        return ResponseEntity.noContent().build();
    }
}
