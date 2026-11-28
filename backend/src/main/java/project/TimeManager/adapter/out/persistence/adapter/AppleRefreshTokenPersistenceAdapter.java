package project.TimeManager.adapter.out.persistence.adapter;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import project.TimeManager.adapter.out.persistence.repository.MemberJpaRepository;
import project.TimeManager.adapter.out.security.AppleRefreshTokenCipher;
import project.TimeManager.domain.port.out.auth.AppleRefreshTokenStorePort;

import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class AppleRefreshTokenPersistenceAdapter implements AppleRefreshTokenStorePort {

    private final MemberJpaRepository memberJpaRepository;
    private final AppleRefreshTokenCipher cipher;

    @Override
    public void save(Long memberId, String refreshToken) {
        int updated = memberJpaRepository.updateAppleRefreshToken(memberId, cipher.encrypt(memberId, refreshToken));
        if (updated == 0) {
            log.info("apple.token not stored — memberId={} missing or deleted", memberId);
        }
    }

    @Override
    public Optional<String> find(Long memberId) {
        return memberJpaRepository.findAppleRefreshTokenIncludingDeleted(memberId)
                .map(stored -> cipher.decrypt(memberId, stored));
    }

    @Override
    public void clear(Long memberId) {
        memberJpaRepository.clearAppleRefreshToken(memberId);
    }
}
