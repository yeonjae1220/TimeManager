package project.TimeManager.domain.member.model;

public class Member {

    private MemberId id;
    private String name;
    private String email;
    private String hashedPassword;

    private Member() {}

    public static Member create(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("회원 이름은 필수입니다");
        }
        Member member = new Member();
        member.name = name;
        return member;
    }

    public static Member register(String name, String email, String hashedPassword) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("회원 이름은 필수입니다");
        }
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("이메일은 필수입니다");
        }
        if (hashedPassword == null || hashedPassword.isBlank()) {
            throw new IllegalArgumentException("비밀번호는 필수입니다");
        }
        Member member = new Member();
        member.name = name;
        member.email = email;
        member.hashedPassword = hashedPassword;
        return member;
    }

    public static Member reconstitute(MemberId id, String name) {
        Member member = new Member();
        member.id = id;
        member.name = name;
        return member;
    }

    public static Member reconstitute(MemberId id, String name, String email, String hashedPassword) {
        Member member = new Member();
        member.id = id;
        member.name = name;
        member.email = email;
        member.hashedPassword = hashedPassword;
        return member;
    }

    public MemberId getId() { return id; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getHashedPassword() { return hashedPassword; }
}
