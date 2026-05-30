package project.TimeManager.shared.security;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import project.TimeManager.adapter.out.persistence.entity.MemberJpaEntity;
import project.TimeManager.adapter.out.persistence.repository.MemberJpaRepository;
import project.TimeManager.domain.member.model.MemberRole;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminUserDetailsService implements UserDetailsService {

    private final MemberJpaRepository memberJpaRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        MemberJpaEntity entity = memberJpaRepository.findByEmail(email)
                .filter(m -> m.getRole() == MemberRole.ADMIN)
                // HIGH-1 fix: 이메일을 에러 메시지에 노출하지 않음
                .orElseThrow(() -> new UsernameNotFoundException("인증에 실패했습니다"));

        return User.builder()
                .username(entity.getEmail())
                .password(entity.getPassword())
                .authorities(List.of(new SimpleGrantedAuthority("ADMIN")))
                .build();
    }
}
