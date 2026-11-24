package project.TimeManager.application.service.notification;

import java.net.URI;
import java.util.Locale;
import java.util.Set;

final class WebPushEndpoint {
    private static final Set<String> PROVIDERS = Set.of(
            "fcm.googleapis.com", "updates.push.services.mozilla.com",
            "web.push.apple.com", "notify.windows.com"
    );

    private WebPushEndpoint() {}

    static boolean isAllowed(String value) {
        if (value == null || value.length() > 512) return false;
        try {
            URI uri = URI.create(value);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null
                    || uri.getUserInfo() != null || uri.getFragment() != null
                    || (uri.getPort() != -1 && uri.getPort() != 443)
                    || uri.getPath().length() < 2) return false;
            String host = uri.getHost().toLowerCase(Locale.ROOT);
            return PROVIDERS.contains(host) || host.endsWith(".notify.windows.com");
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
