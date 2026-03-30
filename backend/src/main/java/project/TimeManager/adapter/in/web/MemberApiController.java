package project.TimeManager.adapter.in.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import project.TimeManager.adapter.in.web.dto.request.RegisterMemberRequest;
import project.TimeManager.adapter.in.web.dto.request.UpdateMemberProfileRequest;
import project.TimeManager.application.dto.command.member.RegisterMemberCommand;
import project.TimeManager.application.dto.command.member.UpdateMemberProfileCommand;
import project.TimeManager.application.dto.result.MemberProfileResult;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.port.in.member.DeleteMemberUseCase;
import project.TimeManager.domain.port.in.member.GetMemberProfileUseCase;
import project.TimeManager.domain.port.in.member.RegisterMemberUseCase;
import project.TimeManager.domain.port.in.member.UpdateMemberProfileUseCase;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/members")
public class MemberApiController {

    private final RegisterMemberUseCase registerMemberUseCase;
    private final GetMemberProfileUseCase getMemberProfileUseCase;
    private final UpdateMemberProfileUseCase updateMemberProfileUseCase;
    private final DeleteMemberUseCase deleteMemberUseCase;

    @PostMapping
    public ResponseEntity<Map<String, Long>> register(@Valid @RequestBody RegisterMemberRequest request) {
        MemberId memberId = registerMemberUseCase.register(
                new RegisterMemberCommand(request.name(), request.email(), request.password()));
        return ResponseEntity.status(201).body(Map.of("memberId", memberId.value()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<MemberProfileResult> getProfile(
            @PathVariable Long id,
            @AuthenticationPrincipal Long principalId) {
        if (!principalId.equals(id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        return ResponseEntity.ok(getMemberProfileUseCase.getProfile(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<MemberProfileResult> updateProfile(
            @PathVariable Long id,
            @AuthenticationPrincipal Long principalId,
            @RequestBody UpdateMemberProfileRequest request) {
        if (!principalId.equals(id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        MemberProfileResult result = updateMemberProfileUseCase.updateProfile(
                new UpdateMemberProfileCommand(id, request.name(), request.newPassword(), request.currentPassword()));
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMember(
            @PathVariable Long id,
            @AuthenticationPrincipal Long principalId) {
        if (!principalId.equals(id)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        deleteMemberUseCase.deleteMember(id);
        return ResponseEntity.noContent().build();
    }
}
