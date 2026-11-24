package project.TimeManager.adapter.in.web.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 프론트엔드의 PushSubscription.toJSON() 결과를 그대로 수신
 * {
 *   "endpoint": "https://...",
 *   "keys": { "p256dh": "...", "auth": "..." }
 * }
 */
public record PushSubscribeRequest(
        @NotBlank @Size(max = 512) String endpoint,
        @NotNull @Valid Keys keys
) {
    public record Keys(
            @NotBlank @Size(max = 256) String p256dh,
            @NotBlank @Size(max = 64) String auth
    ) {}

    public String getP256dh() { return keys != null ? keys.p256dh() : null; }
    public String getAuth()   { return keys != null ? keys.auth()   : null; }
}
