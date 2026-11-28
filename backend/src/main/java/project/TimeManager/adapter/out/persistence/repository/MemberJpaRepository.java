package project.TimeManager.adapter.out.persistence.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.repository.query.Param;
import project.TimeManager.adapter.out.persistence.entity.MemberJpaEntity;
import project.TimeManager.domain.member.model.OAuthProvider;

import java.time.LocalDateTime;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * ⚠️ 조회 메서드는 기본적으로 **삭제되지 않은 회원만** 돌려준다.
 * 삭제된 회원까지 봐야 하는 것은 purge 배치뿐이며, 그 목적의 메서드에는
 * IncludingDeleted 를 붙여 의도를 드러낸다. 이름에 표시가 없는 조회가
 * 삭제된 계정을 반환하기 시작하면 로그인·재발급 관문이 통째로 뚫린다.
 */
public interface MemberJpaRepository extends JpaRepository<MemberJpaEntity, Long> {

    @Query("SELECT m FROM MemberJpaEntity m WHERE m.id = :id AND m.deletedAt IS NULL")
    Optional<MemberJpaEntity> findActiveById(@Param("id") Long id);

    @Query("SELECT m FROM MemberJpaEntity m WHERE m.email = :email AND m.deletedAt IS NULL")
    Optional<MemberJpaEntity> findByEmail(@Param("email") String email);

    @Query("SELECT m FROM MemberJpaEntity m WHERE m.provider = :provider AND m.providerId = :providerId AND m.deletedAt IS NULL")
    Optional<MemberJpaEntity> findByProviderAndProviderId(@Param("provider") OAuthProvider provider,
                                                          @Param("providerId") String providerId);

    @Query("SELECT m FROM MemberJpaEntity m WHERE m.deletedAt IS NULL")
    List<MemberJpaEntity> findAllActive();

    @Query(value = "SELECT m FROM MemberJpaEntity m WHERE m.deletedAt IS NULL",
            countQuery = "SELECT COUNT(m) FROM MemberJpaEntity m WHERE m.deletedAt IS NULL")
    Page<MemberJpaEntity> findAllActive(Pageable pageable);

    @Query("SELECT COUNT(m) FROM MemberJpaEntity m WHERE m.deletedAt IS NULL")
    long countActive();

    /**
     * 일일 리셋 배치가 이 회원의 경계를 처리 완료로 표시한다.
     *
     * 실제 리셋과 같은 트랜잭션에서만 호출해야 한다 — 표시만 커밋되면 그 경계는
     * 다시 시도되지 않는다.
     */
    @Modifying
    @Query("UPDATE MemberJpaEntity m SET m.lastResetBoundaryAt = :boundary WHERE m.id = :memberId")
    void updateLastResetBoundary(@Param("memberId") Long memberId,
                                 @Param("boundary") Instant boundary);

    /** purge 배치 전용 — 유예가 지난 삭제 계정. */
    @Query("SELECT m FROM MemberJpaEntity m WHERE m.deletedAt IS NOT NULL AND m.deletedAt < :threshold")
    List<MemberJpaEntity> findPurgeableIncludingDeleted(@Param("threshold") LocalDateTime threshold);

    /** Apple refresh token 암호문 저장. 삭제된 회원에는 쓰지 않는다(삭제와 로그인이 겹쳐도 되살리지 않게). */
    @Modifying
    @Transactional
    @Query("UPDATE MemberJpaEntity m SET m.appleRefreshToken = :token WHERE m.id = :memberId AND m.deletedAt IS NULL")
    int updateAppleRefreshToken(@Param("memberId") Long memberId, @Param("token") String token);

    @Modifying
    @Transactional
    @Query("UPDATE MemberJpaEntity m SET m.appleRefreshToken = NULL WHERE m.id = :memberId")
    int clearAppleRefreshToken(@Param("memberId") Long memberId);

    /** 삭제된 회원 포함 — 소프트 삭제 직후와 purge 직전에 철회해야 한다. */
    @Query("SELECT m.appleRefreshToken FROM MemberJpaEntity m WHERE m.id = :memberId")
    Optional<String> findAppleRefreshTokenIncludingDeleted(@Param("memberId") Long memberId);
}
