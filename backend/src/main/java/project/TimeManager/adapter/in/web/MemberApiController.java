package project.TimeManager.adapter.in.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import project.TimeManager.adapter.in.web.dto.request.RegisterMemberRequest;
import project.TimeManager.application.dto.command.member.RegisterMemberCommand;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.port.in.member.RegisterMemberUseCase;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/members")
public class MemberApiController {

    private final RegisterMemberUseCase registerMemberUseCase;

    @PostMapping
    public ResponseEntity<Map<String, Long>> register(@Valid @RequestBody RegisterMemberRequest request) {
        MemberId memberId = registerMemberUseCase.register(
                new RegisterMemberCommand(request.name(), request.email(), request.password()));
        return ResponseEntity.status(201).body(Map.of("memberId", memberId.value()));
    }
}
