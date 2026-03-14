package project.TimeManager.adapter.out.security;

import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import project.TimeManager.domain.port.out.auth.PasswordHasherPort;

@Component
@RequiredArgsConstructor
public class BCryptPasswordHasherAdapter implements PasswordHasherPort {

    private final BCryptPasswordEncoder bCryptPasswordEncoder;

    @Override
    public String hash(String raw) {
        return bCryptPasswordEncoder.encode(raw);
    }

    @Override
    public boolean matches(String raw, String hashed) {
        return bCryptPasswordEncoder.matches(raw, hashed);
    }
}
