package project.TimeManager.domain.port.out.auth;

import project.TimeManager.domain.member.model.MemberCredentials;

import java.util.Optional;

public interface LoadMemberCredentialsPort {
    Optional<MemberCredentials> findByEmail(String email);
}
