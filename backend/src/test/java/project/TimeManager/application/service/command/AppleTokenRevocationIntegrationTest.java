package project.TimeManager.application.service.command;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.annotation.DirtiesContext;
import project.TimeManager.adapter.out.persistence.adapter.MemberPersistenceAdapter;
import project.TimeManager.adapter.out.persistence.repository.MemberJpaRepository;
import project.TimeManager.application.dto.command.member.RegisterMemberCommand;
import project.TimeManager.application.service.notification.PushSender;
import project.TimeManager.domain.port.in.member.DeleteMemberUseCase;
import project.TimeManager.domain.port.in.member.PurgeDeletedMembersUseCase;
import project.TimeManager.domain.port.in.member.RegisterMemberUseCase;
import project.TimeManager.domain.port.out.auth.AppleRefreshTokenStorePort;
import project.TimeManager.domain.port.out.auth.AppleTokenPort;

import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.times;

/**
 * Apple 토큰 보관·철회를 실제 DB 로 검증한다. Apple HTTP 만 가짜다.
 *
 * <p>노리는 결함: (1) 평문 저장, (2) 엔티티를 읽어 저장하는 다른 경로(프로필 수정·소프트 삭제)가 토큰 컬럼을
 * 덮어써 철회할 토큰이 사라지는 것, (3) 철회 실패 시 토큰을 지워 purge 재시도 기회를 잃는 것.
 */
@SpringBootTest(properties = "apple.sign-in.token-encryption-key=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AppleTokenRevocationIntegrationTest {

    @MockBean PushSender pushSender;
    @MockBean AppleTokenPort appleTokenPort;

    @Autowired AppleRefreshTokenStorePort tokenStore;
    @Autowired DeleteMemberUseCase deleteMemberUseCase;
    @Autowired PurgeDeletedMembersUseCase purgeDeletedMembersUseCase;
    @Autowired RegisterMemberUseCase registerMemberUseCase;
    @Autowired MemberPersistenceAdapter memberPersistenceAdapter;
    @Autowired MemberJpaRepository memberJpaRepository;

    private static final AtomicInteger SEQ = new AtomicInteger();

    @BeforeEach
    void enable() {
        given(appleTokenPort.isEnabled()).willReturn(true);
    }

    private Long registerWithToken(String refreshToken) {
        int seq = SEQ.incrementAndGet();
        Long memberId = registerMemberUseCase
                .register(new RegisterMemberCommand("apple" + seq, "apple" + seq + "@test.com", "password123")).value();
        tokenStore.save(memberId, refreshToken);
        return memberId;
    }

    private String rawColumn(Long memberId) {
        return memberJpaRepository.findAppleRefreshTokenIncludingDeleted(memberId).orElse(null);
    }

    @Test
    @DisplayName("토큰은 암호화돼 저장되고, 프로필 수정이 그 컬럼을 덮어쓰지 않는다")
    void storedEncryptedAndSurvivesProfileUpdate() {
        Long memberId = registerWithToken("r.plain-apple-token");

        assertThat(rawColumn(memberId)).startsWith("v1.").doesNotContain("plain-apple-token");

        memberPersistenceAdapter.updateMember(memberId, "새 이름", null, null, null);

        assertThat(tokenStore.find(memberId)).contains("r.plain-apple-token");
    }

    @Test
    @DisplayName("탈퇴하면 저장된 토큰으로 철회하고, 성공하면 토큰을 지운다")
    void deleteRevokesAndClears() {
        Long memberId = registerWithToken("r.revoke-me");
        given(appleTokenPort.revokeRefreshToken("r.revoke-me")).willReturn(true);

        deleteMemberUseCase.deleteMember(memberId);

        then(appleTokenPort).should().revokeRefreshToken("r.revoke-me");
        assertThat(rawColumn(memberId)).isNull();
    }

    @Test
    @DisplayName("철회가 실패하면 토큰을 남기고, purge 때 다시 철회한 뒤 계정을 지운다")
    void failedRevocationIsRetriedAtPurge() {
        Long memberId = registerWithToken("r.retry-me");
        given(appleTokenPort.revokeRefreshToken("r.retry-me")).willReturn(false);

        deleteMemberUseCase.deleteMember(memberId);
        assertThat(tokenStore.find(memberId)).as("소프트 삭제 뒤에도 토큰이 남아야 한다").contains("r.retry-me");

        var entity = memberJpaRepository.findById(memberId).orElseThrow();
        entity.setDeletedAt(LocalDateTime.now().minusDays(31));
        memberJpaRepository.save(entity);
        purgeDeletedMembersUseCase.purgeExpired();

        then(appleTokenPort).should(times(2)).revokeRefreshToken("r.retry-me");
        assertThat(memberJpaRepository.findById(memberId)).isEmpty();
    }

    @Test
    @DisplayName("삭제된 회원에게는 토큰을 새로 저장하지 않는다(탈퇴와 로그인이 겹쳐도 되살리지 않음)")
    void doesNotStoreForDeletedMember() {
        Long memberId = registerWithToken("r.first");
        given(appleTokenPort.revokeRefreshToken("r.first")).willReturn(true);
        deleteMemberUseCase.deleteMember(memberId);

        tokenStore.save(memberId, "r.late");

        assertThat(rawColumn(memberId)).isNull();
    }
}
