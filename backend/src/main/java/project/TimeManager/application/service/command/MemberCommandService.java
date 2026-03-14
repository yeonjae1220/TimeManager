package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.application.dto.command.member.RegisterMemberCommand;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.port.in.member.RegisterMemberUseCase;
import project.TimeManager.domain.port.out.auth.LoadMemberCredentialsPort;
import project.TimeManager.domain.port.out.auth.PasswordHasherPort;
import project.TimeManager.domain.port.out.member.InitializeMemberTagsPort;
import project.TimeManager.domain.port.out.member.SaveMemberPort;

@Service
@Transactional
@RequiredArgsConstructor
public class MemberCommandService implements RegisterMemberUseCase {

    private final SaveMemberPort saveMemberPort;
    private final InitializeMemberTagsPort initializeMemberTagsPort;
    private final LoadMemberCredentialsPort loadMemberCredentialsPort;
    private final PasswordHasherPort passwordHasherPort;

    @Override
    public MemberId register(RegisterMemberCommand command) {
        loadMemberCredentialsPort.findByEmail(command.email()).ifPresent(c -> {
            throw new DomainException("이미 사용 중인 이메일입니다");
        });

        String hashedPassword = passwordHasherPort.hash(command.password());
        Member member = Member.register(command.name(), command.email(), hashedPassword);
        Long memberId = saveMemberPort.saveMember(member);

        initializeMemberTagsPort.initializeDefaultTags(MemberId.of(memberId));

        return MemberId.of(memberId);
    }
}
