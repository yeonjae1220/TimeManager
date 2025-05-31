package project.TimeManager.repository;

import com.querydsl.jpa.impl.JPAQueryFactory;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.entity.Member;
import project.TimeManager.entity.Tag;

import java.util.List;

import static project.TimeManager.entity.QMember.member;
import static project.TimeManager.entity.QTag.tag;

@RequiredArgsConstructor
@Repository
public class MemberRepositoryCustomImpl implements MemberRepositoryCustom{

    private final EntityManager em;
    private final JPAQueryFactory jpaQueryFactory;


    @Override
    public Member findByName(String name) {
        return jpaQueryFactory
                .selectFrom(member)
                .where(member.name.eq(name))
                .fetchOne();
    }

    @Override
    public List<Member> findAll() {
        return jpaQueryFactory
                .selectFrom(member)
                .fetch();
    }

    //    @Override
//    public List<Member> findMemberCustom() {
//        return em.createQuery("select m from Member m")
//                .getResultList();
//    }

    /*
    List<MemberDto> result = jpaQueryFactory
                .select(new QMemberDto(member.name))
                .from(member)
                .fetch();
     */
    // fetch join 필요?
    @Override
    @Transactional(readOnly = true)
    public List<Tag> findTagsByMember(Member member) {
        return jpaQueryFactory
                .selectFrom(tag)
                .where(tag.member.id.eq(member.getId()))
                .fetch();
    }
}
