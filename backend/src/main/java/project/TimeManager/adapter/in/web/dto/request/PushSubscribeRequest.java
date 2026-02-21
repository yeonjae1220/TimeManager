package project.TimeManager.adapter.in.web.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 프론트엔드의 PushSubscription.toJSON() 결과를 그대로 수신
 * {
 *   "endpoint": "https://...",
 *   "keys": { "p256dh": "...", "auth": "..." }
 * }
 */
public record PushSubscribeRequest(
        String endpoint,
        Keys keys
) {
    public record Keys(
            String p256dh,
            String auth
    ) {}

    public String getP256dh() { return keys != null ? keys.p256dh() : null; }
    public String getAuth()   { return keys != null ? keys.auth()   : null; }
}
