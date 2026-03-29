package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.application.dto.command.member.UpdateMemberProfileCommand;
import project.TimeManager.application.dto.result.MemberProfileResult;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.member.model.OAuthProvider;
import project.TimeManager.domain.port.in.member.UpdateMemberProfileUseCase;
import project.TimeManager.domain.port.out.auth.PasswordHasherPort;
import project.TimeManager.domain.port.out.member.LoadMemberPort;
import project.TimeManager.domain.port.out.member.UpdateMemberPort;

@Service
@Transactional
@RequiredArgsConstructor
public class UpdateMemberProfileCommandService implements UpdateMemberProfileUseCase {

    private final LoadMemberPort loadMemberPort;
    private final UpdateMemberPort updateMemberPort;
    private final PasswordHasherPort passwordHasherPort;

    @Override
    public MemberProfileResult updateProfile(UpdateMemberProfileCommand command) {
        Member member = loadMemberPort.loadMember(command.memberId())
                .orElseThrow(() -> new DomainException("존재하지 않는 회원입니다"));

        String newName = null;
        if (command.newName() != null && !command.newName().isBlank()) {
            newName = command.newName().trim();
        }

        String newHashedPassword = null;
        if (command.newPassword() != null && !command.newPassword().isBlank()) {
            if (member.getProvider() != OAuthProvider.LOCAL) {
                throw new DomainException("소셜 로그인 계정은 비밀번호를 변경할 수 없습니다");
            }
            if (command.currentPassword() == null || command.currentPassword().isBlank()) {
                throw new DomainException("현재 비밀번호를 입력해 주세요");
            }
            if (!passwordHasherPort.matches(command.currentPassword(), member.getHashedPassword())) {
                throw new DomainException("현재 비밀번호가 올바르지 않습니다");
            }
            newHashedPassword = passwordHasherPort.hash(command.newPassword());
        }

        if (newName == null && newHashedPassword == null) {
            return new MemberProfileResult(
                    member.getId().value(),
                    member.getName(),
                    member.getEmail(),
                    member.getProvider().name()
            );
        }

        updateMemberPort.updateMember(command.memberId(), newName, newHashedPassword);

        Member updated = loadMemberPort.loadMember(command.memberId())
                .orElseThrow(() -> new DomainException("존재하지 않는 회원입니다"));
        return new MemberProfileResult(
                updated.getId().value(),
                updated.getName(),
                updated.getEmail(),
                updated.getProvider().name()
        );
    }
}
