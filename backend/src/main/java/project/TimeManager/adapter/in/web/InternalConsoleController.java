package project.TimeManager.adapter.in.web;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import project.TimeManager.application.service.admin.AdminService;

import java.util.List;
import java.util.Map;

/**
 * Read-only summary consumed by the lab.mungji console aggregator.
 * Returns aggregate counts only (no PII), gated by ServiceTokenAuthFilter
 * on the /api/internal/** security chain.
 */
@RestController
@RequestMapping("/api/internal/console")
@RequiredArgsConstructor
public class InternalConsoleController {

    private final AdminService adminService;

    @GetMapping("/summary")
    public Map<String, Object> summary() {
        long totalUsers = adminService.getTotalMemberCount();
        long pushSubscribers = adminService.getPushSubscriberCount();
        return Map.of(
                "totalUsers", totalUsers,
                "usage", List.of(
                        Map.of("label", "기록", "value", 0),
                        Map.of("label", "태그", "value", pushSubscribers)
                )
        );
    }
}
