package project.TimeManager.adapter.in.web;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import project.TimeManager.adapter.in.web.dto.request.UpdateMemberRoleRequest;
import project.TimeManager.adapter.in.web.dto.response.AdminMemberResponse;
import project.TimeManager.adapter.in.web.dto.response.AdminStatsResponse;
import project.TimeManager.application.service.admin.AdminService;
import project.TimeManager.domain.member.model.Member;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/admin")
public class AdminApiController {

    private final AdminService adminService;

    @GetMapping("/members")
    public ResponseEntity<Map<String, Object>> getMembers(
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.DESC) Pageable pageable) {
        Page<Member> page = adminService.getMembers(pageable);
        Page<AdminMemberResponse> responsePage = page.map(AdminMemberResponse::from);
        return ResponseEntity.ok(Map.of(
                "content", responsePage.getContent(),
                "totalElements", responsePage.getTotalElements(),
                "totalPages", responsePage.getTotalPages(),
                "number", responsePage.getNumber(),
                "size", responsePage.getSize()
        ));
    }

    @PatchMapping("/members/{id}/role")
    public ResponseEntity<Void> updateMemberRole(
            @PathVariable Long id,
            @Valid @RequestBody UpdateMemberRoleRequest request) {
        adminService.updateMemberRole(id, request.role());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/stats")
    public ResponseEntity<AdminStatsResponse> getStats() {
        long totalMembers = adminService.getTotalMemberCount();
        return ResponseEntity.ok(new AdminStatsResponse(totalMembers));
    }
}
