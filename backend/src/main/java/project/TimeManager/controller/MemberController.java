package project.TimeManager.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import project.TimeManager.Service.MemberService;
import project.TimeManager.entity.Member;

@Controller
@RequiredArgsConstructor
@RequestMapping("/tt")
@Slf4j
public class MemberController {

    private final MemberService memberService;
    // List<MemberDto> 이런식으로 받기


    // 도메인 클래스 컨버터 . HTTP 파라미터로 넘어온 엔티티의 아이디로 엔티티 객체를 찾아서 바인딩
    // 도메인 클래스 컨버터도 리파지토리를 사용해서 엔티티를 찾음
    // 도메인 클래스 컨버터로 엔티티를 파라미터로 받으면, 이 엔티티는 단순 조회용으로만 사용해야 한다. (트랜잭션이 없는 범위에서 엔티티를 조회했으므로, 엔티티를 변경해도 DB에 반영되지 않는다.)
    // 단순한 경우면 몰라도 Pk 외부 노출 안좋다.
    @GetMapping
    public String home() {
        // return "redirect:/home.html";
        return "index.html";
    }
    @GetMapping("/{memberId}")
    public String findMember(@PathVariable Long memberId, Model model){
        Member member = memberService.findById(memberId);
        model.addAttribute("member", member);
        // return "redirect:/" + memberId;
        return "mindmap";
    }
    // 타임리프 그레들에 추가 안하니 작동을 안하네 뷰리졸버가

    // 예) `/members?page=0&size=3&sort=id,desc&sort=username,desc` 이런 식으로 요청 받음
    //  spring.data.web.pageable.default-page-size=20 /# 기본 페이지 사이즈/
    //  spring.data.web.pageable.max-page-size=2000 /# 최대 페이지 사이즈/
    // 위 두가지를 글로벌 설정: 스프링 부트 에다가 집어 넣어도 되고
    //

    /*
    @RequestMapping(value = "/members_page", method = RequestMethod.GET)
public String list(@PageableDefault(size = 12, sort = "username",
direction = Sort.Direction.DESC) Pageable pageable) {
...
}
     */
    // 이런 식으로 개별 설정 가능
//    @GetMapping("/members")
//    public Page<MemberDto> list(Pageable pageable) {
//        return memberRepository.findAll(pageable).map(MemberDto::new);
//    }


    // 테스트용 데이터
    // 데이터 필요하면 querydsl ch6 실무활용 10P참고 (5장인가?)
//    @PostConstruct
//    public void init() {
//        memberRepository.save(new Member("member1"));
//        memberRepository.save(new Member("member2"));
//    }



}
