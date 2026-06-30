package project.TimeManager.adapter.out.redis;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import project.TimeManager.domain.auth.model.AuthSession;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.shared.security.TokenHasher;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RedisTokenStoreAdapterTest {

    private static final String PLAINTEXT_TOKEN = "high-entropy-refresh-token-value";

    @Mock
    private AuthSessionRedisRepository repository;

    @InjectMocks
    private RedisTokenStoreAdapter adapter;

    @Captor
    private ArgumentCaptor<AuthSessionRedisEntity> entityCaptor;

    @Test
    @DisplayName("save stores the SHA-256 hash as the id, never the plaintext token")
    void save_storesHashedTokenId() {
        Instant expiresAt = Instant.now().plus(30, ChronoUnit.DAYS);
        AuthSession session = AuthSession.create(MemberId.of(42L), PLAINTEXT_TOKEN, expiresAt);

        adapter.save(session);

        verify(repository).save(entityCaptor.capture());
        AuthSessionRedisEntity saved = entityCaptor.getValue();
        assertThat(saved.getTokenHash()).isEqualTo(TokenHasher.sha256(PLAINTEXT_TOKEN));
        assertThat(saved.getTokenHash()).isNotEqualTo(PLAINTEXT_TOKEN);
        assertThat(saved.getMemberId()).isEqualTo(42L);
        assertThat(saved.getExpiresAt()).isEqualTo(expiresAt);
        assertThat(saved.getLastRotatedAt()).isNotNull();
    }

    @Test
    @DisplayName("findByRefreshToken looks up by hash and returns the domain session with the original token")
    void findByRefreshToken_looksUpByHash() {
        Instant expiresAt = Instant.now().plus(10, ChronoUnit.DAYS);
        Instant lastRotatedAt = Instant.now().minus(1, ChronoUnit.HOURS);
        AuthSessionRedisEntity entity = new AuthSessionRedisEntity();
        entity.setTokenHash(TokenHasher.sha256(PLAINTEXT_TOKEN));
        entity.setMemberId(7L);
        entity.setExpiresAt(expiresAt);
        entity.setLastRotatedAt(lastRotatedAt);
        when(repository.findById(TokenHasher.sha256(PLAINTEXT_TOKEN))).thenReturn(Optional.of(entity));

        Optional<AuthSession> result = adapter.findByRefreshToken(PLAINTEXT_TOKEN);

        assertThat(result).isPresent();
        assertThat(result.get().getMemberId()).isEqualTo(MemberId.of(7L));
        assertThat(result.get().getExpiresAt()).isEqualTo(expiresAt);
        assertThat(result.get().getLastRotatedAt()).isEqualTo(lastRotatedAt);
        // domain session carries the original plaintext token for downstream use
        assertThat(result.get().getRefreshToken()).isEqualTo(PLAINTEXT_TOKEN);
    }

    @Test
    @DisplayName("findByRefreshToken maps null lastRotatedAt to Instant.EPOCH so the session will rotate immediately")
    void findByRefreshToken_nullLastRotatedAt_mapsToEpoch() {
        Instant expiresAt = Instant.now().plus(10, ChronoUnit.DAYS);
        AuthSessionRedisEntity entity = new AuthSessionRedisEntity();
        entity.setTokenHash(TokenHasher.sha256(PLAINTEXT_TOKEN));
        entity.setMemberId(7L);
        entity.setExpiresAt(expiresAt);
        // lastRotatedAt intentionally not set (simulates legacy Redis entry)
        when(repository.findById(TokenHasher.sha256(PLAINTEXT_TOKEN))).thenReturn(Optional.of(entity));

        Optional<AuthSession> result = adapter.findByRefreshToken(PLAINTEXT_TOKEN);

        assertThat(result).isPresent();
        assertThat(result.get().getLastRotatedAt()).isEqualTo(java.time.Instant.EPOCH);
    }

    @Test
    @DisplayName("findByRefreshToken returns empty when no session is stored for the hash")
    void findByRefreshToken_notFound_returnsEmpty() {
        when(repository.findById(TokenHasher.sha256(PLAINTEXT_TOKEN))).thenReturn(Optional.empty());

        assertThat(adapter.findByRefreshToken(PLAINTEXT_TOKEN)).isEmpty();
    }

    @Test
    @DisplayName("delete removes the entry by hashed id, never the plaintext token")
    void delete_removesByHash() {
        adapter.delete(PLAINTEXT_TOKEN);

        verify(repository).deleteById(TokenHasher.sha256(PLAINTEXT_TOKEN));
    }
}
