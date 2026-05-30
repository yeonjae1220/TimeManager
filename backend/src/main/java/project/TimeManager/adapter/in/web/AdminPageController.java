package project.TimeManager.adapter.in.web;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import project.TimeManager.application.service.admin.AdminService;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.member.model.MemberRole;
import project.TimeManager.domain.tag.model.Tag;

import java.util.List;

@Controller
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminPageController {

    private final AdminService adminService;

    @GetMapping({"", "/", "/dashboard"})
    public String dashboard(Model model) {
        // MEDIUM-4 fix: getStalledRunningTags를 한 번만 호출해 재사용
        List<Tag> stalledTags = adminService.getStalledRunningTags(2);
        model.addAttribute("totalMembers", adminService.getTotalMemberCount());
        model.addAttribute("stalledTimerCount", stalledTags.size());
        model.addAttribute("pushSubscriberCount", adminService.getPushSubscriberCount());
        return "admin/dashboard";
    }

    @GetMapping("/members")
    public String members(@RequestParam(defaultValue = "0") int page, Model model) {
        Page<Member> memberPage = adminService.getMembers(
                PageRequest.of(page, 20, Sort.by(Sort.Direction.DESC, "id")));
        model.addAttribute("members", memberPage.getContent());
        model.addAttribute("currentPage", page);
        model.addAttribute("totalPages", memberPage.getTotalPages());
        model.addAttribute("totalElements", memberPage.getTotalElements());
        return "admin/members";
    }

    @PostMapping("/members/{id}/role")
    public String updateRole(@PathVariable Long id,
                             @RequestParam MemberRole role,
                             RedirectAttributes redirectAttributes) {
        adminService.updateMemberRole(id, role);
        redirectAttributes.addFlashAttribute("successMessage", "역할이 변경되었습니다.");
        return "redirect:/admin/members";
    }

    @PostMapping("/members/{id}/delete")
    public String deleteMember(@PathVariable Long id, RedirectAttributes redirectAttributes) {
        adminService.deleteMember(id);
        redirectAttributes.addFlashAttribute("successMessage", "멤버가 삭제되었습니다.");
        return "redirect:/admin/members";
    }

    @GetMapping("/timers")
    public String timers(Model model) {
        List<Tag> stalledTags = adminService.getStalledRunningTags(2);
        model.addAttribute("stalledTags", stalledTags);
        return "admin/timers";
    }

    @PostMapping("/timers/{tagId}/stop")
    public String forceStop(@PathVariable Long tagId, RedirectAttributes redirectAttributes) {
        adminService.forceStopTimer(tagId);
        redirectAttributes.addFlashAttribute("successMessage", "타이머가 강제 종료되었습니다.");
        return "redirect:/admin/timers";
    }

    @GetMapping("/push")
    public String push(Model model) {
        model.addAttribute("members", adminService.getAllMembers());
        model.addAttribute("subscriberCount", adminService.getPushSubscriberCount());
        return "admin/push";
    }

    @PostMapping("/push/all")
    public String pushAll(@RequestParam String title,
                          @RequestParam String body,
                          RedirectAttributes redirectAttributes) {
        adminService.sendPushToAll(title, body);
        redirectAttributes.addFlashAttribute("successMessage", "전체 Push 발송 완료.");
        return "redirect:/admin/push";
    }

    @PostMapping("/push/member")
    public String pushMember(@RequestParam Long memberId,
                             @RequestParam String title,
                             @RequestParam String body,
                             RedirectAttributes redirectAttributes) {
        adminService.sendPushToMember(memberId, title, body);
        redirectAttributes.addFlashAttribute("successMessage", "Push 발송 완료.");
        return "redirect:/admin/push";
    }

    @GetMapping("/login")
    public String loginPage() {
        return "admin/login";
    }
}
