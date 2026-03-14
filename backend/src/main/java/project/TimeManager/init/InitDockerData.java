package project.TimeManager.init;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import project.TimeManager.application.dto.command.member.RegisterMemberCommand;
import project.TimeManager.domain.port.in.member.RegisterMemberUseCase;
import project.TimeManager.domain.port.out.member.LoadMemberPort;

@Profile("docker")
@Component
@RequiredArgsConstructor
@Slf4j
public class InitDockerData {

    private final RegisterMemberUseCase registerMemberUseCase;
    private final LoadMemberPort loadMemberPort;

    @PostConstruct
    public void init() {
        if (loadMemberPort.loadMember(1L).isEmpty()) {
            Long memberId = registerMemberUseCase.register(new RegisterMemberCommand("admin", "admin@admin.com", "admin1234")).value();
            log.info("Docker init: created default member (id={})", memberId);
        }
    }
}
