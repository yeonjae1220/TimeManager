package project.TimeManager.adapter.in.web;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import project.TimeManager.domain.exception.ResourceForbiddenException;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import project.TimeManager.adapter.in.web.dto.request.PushSubscribeRequest;
import project.TimeManager.adapter.in.web.dto.request.PushUnsubscribeRequest;
import project.TimeManager.application.dto.command.SavePushSubscriptionCommand;
import project.TimeManager.domain.port.in.notification.SavePushSubscriptionUseCase;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/push/subscriptions")
public class NotificationApiController {

    private final SavePushSubscriptionUseCase savePushSubscriptionUseCase;

    @PostMapping("/{memberId}")
    public ResponseEntity<Void> subscribe(
            @PathVariable Long memberId,
            @AuthenticationPrincipal Long principalId,
            @Valid @RequestBody PushSubscribeRequest request) {
        requireOwner(memberId, principalId);
        savePushSubscriptionUseCase.saveSubscription(
                new SavePushSubscriptionCommand(principalId, request.endpoint(),
                        request.getP256dh(), request.getAuth()));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{memberId}")
    public ResponseEntity<Void> unsubscribe(
            @PathVariable Long memberId,
            @AuthenticationPrincipal Long principalId,
            @Valid @RequestBody PushUnsubscribeRequest request) {
        requireOwner(memberId, principalId);
        savePushSubscriptionUseCase.deleteSubscription(principalId, request.endpoint());
        return ResponseEntity.noContent().build();
    }

    private void requireOwner(Long memberId, Long principalId) {
        if (!memberId.equals(principalId)) throw new ResourceForbiddenException();
    }
}
