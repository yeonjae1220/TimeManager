package project.TimeManager.adapter.out.persistence.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import project.TimeManager.domain.member.model.MemberRole;
import project.TimeManager.domain.member.model.OAuthProvider;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "member")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MemberJpaEntity {

    @Id
    @GeneratedValue
    @Column(name = "member_id")
    private Long id;

    private String name;

    @Column(name = "email", unique = true)
    private String email;

    @Column(name = "password")
    private String password;

    @Column(name = "provider", nullable = false, length = 30)
    @Enumerated(EnumType.STRING)
    private OAuthProvider provider = OAuthProvider.LOCAL;

    @Column(name = "provider_id")
    private String providerId;

    @Column(name = "role", columnDefinition = "VARCHAR(20) NOT NULL DEFAULT 'MEMBER'")
    @Enumerated(EnumType.STRING)
    private MemberRole role = MemberRole.MEMBER;

    @Column(name = "timezone", nullable = false, length = 50)
    private String timezone = "Asia/Seoul";

    @Column(name = "daily_reset_hour", nullable = false)
    private int dailyResetHour = 5;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /**
     * 삭제 요청 시각. NULL 이면 정상 계정이다.
     *
     * 값이 있는 회원은 MemberPersistenceAdapter 의 모든 조회에서 빠진다 — 즉 이 한
     * 컬럼이 로그인·재발급·관리자 목록·배치까지 전부 막는 관문이다. 태그·기록에는
     * 같은 컬럼을 두지 않는다. 그 데이터는 회원을 통해서만 도달할 수 있으므로
     * 회원이 막히면 함께 막히고, 모든 태그·기록 쿼리에 필터를 흩뿌리면 한 곳만
     * 빠뜨려도 삭제된 데이터가 새어 나온다.
     */
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @OneToMany(mappedBy = "member", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TagJpaEntity> tagList = new ArrayList<>();

    public MemberJpaEntity(String name) {
        this.name = name;
    }
}
