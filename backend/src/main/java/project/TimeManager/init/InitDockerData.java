package project.TimeManager.init;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import project.TimeManager.application.port.in.member.CreateMemberUseCase;
import project.TimeManager.application.port.out.member.LoadMemberPort;

@Profile("docker")
@Component
@RequiredArgsConstructor
@Slf4j
public class InitDockerData {

    private final CreateMemberUseCase createMemberUseCase;
    private final LoadMemberPort loadMemberPort;

    @PostConstruct
    public void init() {
        if (loadMemberPort.loadMember(1L).isEmpty()) {
            Long memberId = createMemberUseCase.createMember("admin");
            log.info("Docker init: created default member (id={})", memberId);
        }
    }
}
