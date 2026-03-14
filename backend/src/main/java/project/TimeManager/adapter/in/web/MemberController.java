package project.TimeManager.adapter.in.web;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.port.in.member.GetMemberQuery;

@Controller
@RequiredArgsConstructor
@RequestMapping("/tt")
@Slf4j
public class MemberController {

    private final GetMemberQuery getMemberQuery;

    @GetMapping
    public String home() {
        return "index.html";
    }

    @GetMapping("/{memberId}")
    public String findMember(@PathVariable Long memberId, Model model) {
        Member member = getMemberQuery.getMember(memberId)
                .orElseThrow(() -> new DomainException("Member not found: " + memberId));
        model.addAttribute("member", member);
        return "mindmap";
    }
}
