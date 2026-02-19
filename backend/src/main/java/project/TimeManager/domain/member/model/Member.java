package project.TimeManager.domain.member.model;

public class Member {

    private MemberId id;
    private String name;

    private Member() {}

    public static Member create(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("회원 이름은 필수입니다");
        }
        Member member = new Member();
        member.name = name;
        return member;
    }

    public static Member reconstitute(MemberId id, String name) {
        Member member = new Member();
        member.id = id;
        member.name = name;
        return member;
    }

    public MemberId getId() { return id; }
    public String getName() { return name; }
}
