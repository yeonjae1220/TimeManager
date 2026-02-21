package project.TimeManager.adapter.out.persistence.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "push_subscription",
        uniqueConstraints = @UniqueConstraint(columnNames = "endpoint"))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PushSubscriptionJpaEntity {

    @Id
    @GeneratedValue
    @Column(name = "push_sub_id")
    private Long id;

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Column(nullable = false, length = 512)
    private String endpoint;

    @Column(nullable = false, length = 256)
    private String p256dh;

    @Column(nullable = false, length = 64)
    private String auth;

    public PushSubscriptionJpaEntity(Long memberId, String endpoint, String p256dh, String auth) {
        this.memberId = memberId;
        this.endpoint = endpoint;
        this.p256dh   = p256dh;
        this.auth     = auth;
    }
}
