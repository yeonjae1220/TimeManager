package project.TimeManager.entity;

import com.querydsl.core.Tuple;
import com.querydsl.core.types.Projections;
import com.querydsl.jpa.impl.JPAQueryFactory;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.PersistenceUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.dto.MemberDto;


import java.time.ZonedDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static project.TimeManager.entity.QMember.member;
import static project.TimeManager.entity.QTag.tag;


@SpringBootTest
@Transactional
public class QuerydslBasicTest {

    @Autowired
    EntityManager em;

    JPAQueryFactory queryFactory;
    @BeforeEach
    public void before() {
        queryFactory = new JPAQueryFactory(em);

        Member testMember1 = new Member("testMember1");
        Member testMember2 = new Member("testMember2");
        em.persist(testMember1);
        em.persist(testMember2);

        Tag tag1 = new Tag("tag1", testMember1);
        Tag tag2 = new Tag("tag2", testMember1);
        Tag tag3 = new Tag("tag3", testMember2);
        Tag tag4 = new Tag("tag4", testMember2);
        em.persist(tag1);
        em.persist(tag2);
        em.persist(tag3);
        em.persist(tag4);

        Records record1 = new Records(tag1, ZonedDateTime.now());
        Records record2 = new Records(tag2, ZonedDateTime.now());
        Records record3 = new Records(tag3, ZonedDateTime.now());
        Records record4 = new Records(tag4, ZonedDateTime.now());
        em.persist(record1);
        em.persist(record2);
        em.persist(record3);
        em.persist(record4);
    }

    @Test
    public void startJPQL() {
        //member1을 찾아라.
        String qlString = "select m from Member m " + "where m.name = :name";
        Member findMember = em.createQuery(qlString, Member.class)
                .setParameter("name", "testMember1")
                .getSingleResult();

        assertThat(findMember.getName()).isEqualTo("testMember1");
    }

    @Test
    public void startQuerydsl() {
//        QMember m = new QMember("m"); // 별칭같은건데, QMember에 가보면 이미 만들어져 있다.


        Member findMember = queryFactory
                .select(member)
                .from(member)
                .where(member.name.eq("testMember1")) // 이렇게 짜도 자동으로 sql에 있는 jdbc에 있는 prepare statement로 파라미터 바인딩을 자동으로 합니다
                .fetchOne();

        assertThat(findMember.getName()).isEqualTo("testMember1");
    }

    @Test
    public void search() {
        Member findMember = queryFactory
                .selectFrom(member)
                .where(member.name.eq("testMember1").and(member.tagList.size().eq(4))) // 디폴트 태그 2개가 있음
                .fetchOne();

        assertThat(findMember.getName()).isEqualTo("testMember1");
    }

    @Test
    public void searchAndParam() {
        Member findMember = queryFactory
                .selectFrom(member)
                .where(member.name.eq("testMember1"),
                        member.tagList.size().eq(4))
                .fetchOne();

        assertThat(findMember.getName()).isEqualTo("testMember1");
    }

//    @Test
//    public void resultFetch() {
//        List<Member> fetch = queryFactory
//                .selectFrom(member)
//                .fetch();
//
//        Member fetchOne = queryFactory
//                .selectFrom(member)
//                .fetchOne();
//
//        Member fetchFirst = queryFactory
//                .selectFrom(member)
//                .fetchFirst();
//
//        QueryResults<Member> results = queryFactory
//                .selectFrom(member)
//                .fetchResults();
//
//        results.getTotal();
//        List<Member> content = results.getResults();
//
//        long total = queryFactory
//                .selectFrom(member)
//                .fetchCount();
//    }

    /**
     * 회원 정렬 순서
     * 1. 회원 나이 내림차순(desc)
     * 2. 회원 이름 올림차순(asc)
     * 단 2에서 회원 이름이 없으면 마지막에 출력(nulls last)
     */
//    @Test
//    public void sort() {
//        em.persist(new Member(null, 100));
//        em.persist(new Member("member5", 100));
//        em.persist(new Member("member6", 100));
//        List<Member> result = queryFactory
//                .selectFrom(member)
//                .where(member.age.eq(100))
//                .orderBy(member.age.desc(), member.username.asc().nullsLast())
//                .fetch();
//        Member member5 = result.get(0);
//        Member member6 = result.get(1);
//        Member memberNull = result.get(2);
//        assertThat(member5.getUsername()).isEqualTo("member5");
//        assertThat(member6.getUsername()).isEqualTo("member6");
//        assertThat(memberNull.getUsername()).isNull();
//    }

    /*
    @Test
public void paging1() {
List<Member> result = queryFactory
.selectFrom(member)
.orderBy(member.username.desc())
.offset(1) //0부터 시작(zero index)
.limit(2) //최대 2건 조회
.fetch();
assertThat(result.size()).isEqualTo(2);
}
     */

    /*
    @Test
public void paging2() {
QueryResults<Member> queryResults = queryFactory
.selectFrom(member)
.orderBy(member.username.desc())
.offset(1)
.limit(2)
.fetchResults();
assertThat(queryResults.getTotal()).isEqualTo(4);
assertThat(queryResults.getLimit()).isEqualTo(2);
assertThat(queryResults.getOffset()).isEqualTo(1);
assertThat(queryResults.getResults().size()).isEqualTo(2);
}
     */

/*

* JPQL
* select
* COUNT(m), //회원수
* SUM(m.age), //나이 합
* AVG(m.age), //평균 나이
* MAX(m.age), //최대 나이
* MIN(m.age) //최소 나이
* from Member m

    @Test
    public void aggregation() throws Exception {
        List<Tuple> result = queryFactory
                .select(member.count(),
                        member.age.sum(),
                        member.age.avg(),
                        member.age.max(),
                        member.age.min())
                .from(member)
                .fetch();
        Tuple tuple = result.get(0);
        assertThat(tuple.get(member.count())).isEqualTo(4);
        assertThat(tuple.get(member.age.sum())).isEqualTo(100);
        assertThat(tuple.get(member.age.avg())).isEqualTo(25);
        assertThat(tuple.get(member.age.max())).isEqualTo(40);
        assertThat(tuple.get(member.age.min())).isEqualTo(10);
    }
 */

/*
   @Test
* 팀의 이름과 각 팀의 평균 연령을 구해라.
public void group() throws Exception {
List<Tuple> result = queryFactory
.select(team.name, member.age.avg())
.from(member)
.join(member.team, team)
.groupBy(team.name)
.fetch();
Tuple teamA = result.get(0);
Tuple teamB = result.get(1);
assertThat(teamA.get(team.name)).isEqualTo("teamA");
assertThat(teamA.get(member.age.avg())).isEqualTo(15);
assertThat(teamB.get(team.name)).isEqualTo("teamB");
assertThat(teamB.get(member.age.avg())).isEqualTo(35);
}
*/

    @Test
    public void join() {
        List<Tag> result = queryFactory
                .selectFrom(tag)
                .join(tag.member, member)
                .where(member.name.eq("testMember1"))
                .fetch();

        //assertThat(result.getName()).isEqualTo("tag1");

        assertThat(result)
                .extracting("name")
                .containsExactly("root", "discarded", "tag1", "tag2");
    }


    /**
     * 예) 회원과 팀을 조인하면서, 팀 이름이 teamA인 팀만 조인, 회원은 모두 조회
     * JPQL: SELECT m, t FROM Member m LEFT JOIN m.team t on t.name = 'teamA'
     * SQL: SELECT m.*, t.* FROM Member m LEFT JOIN Team t ON m.TEAM_ID=t.id and t.name='teamA'
     */
    @Test
    public void join_on_filtering() throws Exception {
        List<Tuple> result = queryFactory
                .select(tag, member)
                .from(tag)
                .leftJoin(tag.member, member).on(member.name.eq("testMember1"))
                .fetch();
        for (Tuple tuple : result) {
            System.out.println("tuple = " + tuple);
        }
    }

    /*
    태그만 조회하고, 멤버 이런건 조회 안하는 것을 볼 수 있다.
     */
    @PersistenceUnit
    EntityManagerFactory emf;
    @Test
    public void fetchJoinNo() {
        em.flush();
        em.clear();

        Tag findTag = queryFactory
                .selectFrom(tag)
                .where(tag.name.eq("tag1"))
                .fetchOne();

        boolean loaded = emf.getPersistenceUnitUtil().isLoaded(findTag.getMember());
        assertThat(loaded).as("페치 조인 미적용").isFalse();
    }

    @Test
    public void fetchJoinUse() {
        em.flush();
        em.clear();

        Tag findTag = queryFactory
                .selectFrom(tag)
                .join(tag.member, member).fetchJoin()
                .where(tag.name.eq("tag1"))
                .fetchOne();

        boolean loaded = emf.getPersistenceUnitUtil().isLoaded(findTag.getMember());
        assertThat(loaded).as("페치 조인 적용").isTrue();
    }

    @Test
    public void findDtoBySetter() {
        List<MemberDto> result = queryFactory
                .select(Projections.bean(MemberDto.class,
                        member.name))
                .from(member)
                .fetch();

        for (MemberDto memberDto : result) {
            System.out.println("memberDto = " + memberDto);
        }
    }


    @Test
    public void findDtoByField() {
        List<MemberDto> result = queryFactory
                .select(Projections.fields(MemberDto.class,
                        member.name))
                .from(member)
                .fetch();

        for (MemberDto memberDto : result) {
            System.out.println("memberDto = " + memberDto);
        }
    }

    @Test
    public void findDtoByConstructor() {
        List<MemberDto> result = queryFactory
                .select(Projections.constructor(MemberDto.class,
                        member.name))
                .from(member)
                .fetch();

        for (MemberDto memberDto : result) {
            System.out.println("memberDto = " + memberDto);
        }
    }


}
