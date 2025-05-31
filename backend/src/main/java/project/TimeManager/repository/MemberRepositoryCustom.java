package project.TimeManager.repository;

import project.TimeManager.entity.Member;
import project.TimeManager.entity.Tag;

import java.util.List;

public interface MemberRepositoryCustom {
    public Member findByName(String name);

    public List<Member> findAll();

    public List<Tag> findTagsByMember(Member member);
}
