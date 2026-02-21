package project.TimeManager.domain.notification.model;

public class PushSubscription {

    private Long id;
    private Long memberId;
    private String endpoint;
    private String p256dh;  // 공개키
    private String auth;    // 인증 시크릿

    private PushSubscription() {}

    public static PushSubscription create(Long memberId, String endpoint, String p256dh, String auth) {
        PushSubscription sub = new PushSubscription();
        sub.memberId = memberId;
        sub.endpoint = endpoint;
        sub.p256dh   = p256dh;
        sub.auth     = auth;
        return sub;
    }

    public static PushSubscription reconstitute(Long id, Long memberId, String endpoint, String p256dh, String auth) {
        PushSubscription sub = new PushSubscription();
        sub.id       = id;
        sub.memberId = memberId;
        sub.endpoint = endpoint;
        sub.p256dh   = p256dh;
        sub.auth     = auth;
        return sub;
    }

    public Long getId()       { return id; }
    public Long getMemberId() { return memberId; }
    public String getEndpoint() { return endpoint; }
    public String getP256dh()   { return p256dh; }
    public String getAuth()     { return auth; }
}
