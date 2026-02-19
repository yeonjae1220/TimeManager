package project.TimeManager.entity;

import com.querydsl.jpa.impl.JPAQueryFactory;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.PersistenceUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.adapter.out.persistence.entity.MemberJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.QMemberJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.QTagJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.adapter.out.persistence.repository.TagJpaRepository;
import project.TimeManager.application.dto.command.CreateTagCommand;
import project.TimeManager.application.port.in.member.CreateMemberUseCase;
import project.TimeManager.application.port.in.tag.CreateTagUseCase;
import project.TimeManager.domain.tag.model.TagType;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
public class QuerydslBasicTest {

    @Autowired EntityManager em;
    @Autowired CreateMemberUseCase createMemberUseCase;
    @Autowired CreateTagUseCase createTagUseCase;
    @Autowired TagJpaRepository tagJpaRepository;
    @PersistenceUnit EntityManagerFactory emf;

    JPAQueryFactory queryFactory;
    Long testMemberId1;
    Long testMemberId2;

    private static final QMemberJpaEntity member = QMemberJpaEntity.memberJpaEntity;
    private static final QTagJpaEntity tag = QTagJpaEntity.tagJpaEntity;

    @BeforeEach
    void before() {
        queryFactory = new JPAQueryFactory(em);

        testMemberId1 = createMemberUseCase.createMember("testMember1");
        testMemberId2 = createMemberUseCase.createMember("testMember2");

        Long root1Id = tagJpaRepository.findByMemberId(testMemberId1).stream()
                .filter(t -> t.getType() == TagType.ROOT).findFirst().orElseThrow().getId();
        Long root2Id = tagJpaRepository.findByMemberId(testMemberId2).stream()
                .filter(t -> t.getType() == TagType.ROOT).findFirst().orElseThrow().getId();

        createTagUseCase.createTag(new CreateTagCommand("tag1", testMemberId1, root1Id));
        createTagUseCase.createTag(new CreateTagCommand("tag2", testMemberId1, root1Id));
        createTagUseCase.createTag(new CreateTagCommand("tag3", testMemberId2, root2Id));
        createTagUseCase.createTag(new CreateTagCommand("tag4", testMemberId2, root2Id));
    }

    @Test
    @DisplayName("JPQL로 회원 이름 검색")
    void startJPQL() {
        String qlString = "select m from MemberJpaEntity m where m.name = :name";
        MemberJpaEntity findMember = em.createQuery(qlString, MemberJpaEntity.class)
                .setParameter("name", "testMember1")
                .getSingleResult();

        assertThat(findMember.getName()).isEqualTo("testMember1");
    }

    @Test
    @DisplayName("Querydsl로 회원 이름 검색")
    void startQuerydsl() {
        MemberJpaEntity findMember = queryFactory
                .select(member)
                .from(member)
                .where(member.name.eq("testMember1"))
                .fetchOne();

        assertThat(findMember.getName()).isEqualTo("testMember1");
    }

    @Test
    @DisplayName("Querydsl - 이름과 태그 수로 복합 검색 (root + discarded + tag1 + tag2 = 4개)")
    void search() {
        MemberJpaEntity findMember = queryFactory
                .selectFrom(member)
                .where(member.name.eq("testMember1").and(member.tagList.size().eq(4)))
                .fetchOne();

        assertThat(findMember.getName()).isEqualTo("testMember1");
    }

    @Test
    @DisplayName("Querydsl - join으로 특정 회원의 태그 목록 조회")
    void join() {
        List<TagJpaEntity> result = queryFactory
                .selectFrom(tag)
                .join(tag.member, member)
                .where(member.name.eq("testMember1"))
                .fetch();

        assertThat(result)
                .extracting("name")
                .containsExactlyInAnyOrder("root", "discarded", "tag1", "tag2");
    }

    @Test
    @DisplayName("페치 조인 미적용 시 member는 지연 로딩 상태다")
    void fetchJoinNo() {
        em.flush();
        em.clear();

        TagJpaEntity findTag = queryFactory
                .selectFrom(tag)
                .where(tag.name.eq("tag1"))
                .fetchFirst();

        assertThat(findTag).isNotNull();
        boolean loaded = emf.getPersistenceUnitUtil().isLoaded(findTag.getMember());
        assertThat(loaded).as("페치 조인 미적용 → member는 프록시 상태").isFalse();
    }

    @Test
    @DisplayName("페치 조인 적용 시 member가 즉시 로딩된다")
    void fetchJoinUse() {
        em.flush();
        em.clear();

        TagJpaEntity findTag = queryFactory
                .selectFrom(tag)
                .join(tag.member, member).fetchJoin()
                .where(tag.name.eq("tag1"))
                .fetchFirst();

        assertThat(findTag).isNotNull();
        boolean loaded = emf.getPersistenceUnitUtil().isLoaded(findTag.getMember());
        assertThat(loaded).as("페치 조인 적용 → member가 즉시 로딩됨").isTrue();
    }
}
