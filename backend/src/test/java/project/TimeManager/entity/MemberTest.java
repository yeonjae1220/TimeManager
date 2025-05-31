package project.TimeManager.entity;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.repository.MemberRepository;
import project.TimeManager.repository.TagRepository;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
//@Commit
@RequiredArgsConstructor
class MemberTest {

    @Autowired
    EntityManager em;

    @Autowired
    MemberRepository memberRepository;
    @Autowired
    TagRepository tagRepository;

    @Test
    public void testEntity() {
        Member member1 = new Member("member1");
        Member member2 = new Member("member2");
        em.persist(member1);
        em.persist(member2);

        Tag tag1 = new Tag("tag1", member1);
        Tag tag2 = new Tag("tag2", member2);
        em.persist(tag1);
        em.persist(tag2);

        Records record1 = new Records(tag1, ZonedDateTime.now());
        Records record2 = new Records(tag2, ZonedDateTime.now());
        em.persist(record1);
        em.persist(record2);

        em.flush();
        em.clear();

//        List<Member> members = em.createQuery("select m from Member m")
//                .getResultList();

//        assertThat(members.get(0).getName()).isEqualTo("member1");
//        assertThat(members.get(0).getTagList().get(0).getName()).isEqualTo("tag1");
//        System.out.println(members.get(0).getTagList().get(0).getRecords().get(0).getStartTime());
//
//        assertThat(members.get(1).getName()).isEqualTo("member2");
//        assertThat(members.get(1).getTagList().get(0).getName()).isEqualTo("tag2");
//        System.out.println(members.get(1).getTagList().get(0).getRecords().get(0).getStartTime());



    }

    @Test
    public void testPostPersist() {
        Member member = new Member();
        em.persist(member);
        em.flush(); // `@PostPersist`가 호출되어야 함 -> 안하는데?
    }

    @Test
    public void defaultTags() {
        Member member1 = memberRepository.findByName("member1");
        Long memberId = member1.getId();
        List<Tag> tagList = member1.getTagList();
        for (Tag tag : tagList) {
            System.out.println("tag = " + tag);
        }
        // assertThat(member1.getTagList()).containsExactlyInAnyOrder(tagRepository.findByMemberIdAndTagName(memberId, "root").get(), tagRepository.findByMemberIdAndTagName(memberId, "discarded").get());
//        assertThat(member1.getTagList()).containsExactlyInAnyOrder(tagRepository.findByTypeAndMember(TagType.ROOT, member1).get(), tagRepository.findByTypeAndMember(TagType.DISCARDED, member1).get());

    }

    @Test
    public void createNewMemberWithDefaultTagFailed() {
        // Given
        Member newMember = new Member("newMember");
        memberRepository.save(newMember);
        em.persist(newMember); // 영속화
        em.flush();
        // em.clear();

        Long newMemberId = newMember.getId();
        Member persistedMember = em.find(Member.class, newMemberId); // 다시 조회

        // When
        List<Tag> tagList = persistedMember.getTagList();

        // Then
        assertThat(newMember.getName()).isEqualTo("newMember");

        for (Tag tag : tagList) {
            System.out.println("tagList = " + tag);
        }

//        Optional<Tag> rootTag = tagRepository.findByTypeAndMember(TagType.ROOT, newMember);
//        Optional<Tag> discardedTag = tagRepository.findByTypeAndMember(TagType.DISCARDED, newMember);

        // Optional<Tag> rootTag = tagRepository.findByName("root");
        // Optional<Tag> discardedTag = tagRepository.findByName("discarded");
        Optional<Tag> rootTag = tagRepository.findByTypeAndMember(TagType.ROOT, newMember);
        Optional<Tag> discardedTag = tagRepository.findByTypeAndMember(TagType.DISCARDED, newMember);

        assertThat(rootTag).isPresent();
        assertThat(discardedTag).isPresent();

        assertThat(newMember.getTagList()).containsExactlyInAnyOrder(rootTag.get(), discardedTag.get());
    }

    @Test
    public void createNewMemberWithDefaultTagSuccess() {
        // Given
        Member newMember = new Member("newMember");
        memberRepository.save(newMember); // persist 및 flush 호출

        // When
        Member persistedMember = memberRepository.findById(newMember.getId()).orElseThrow();
        List<Tag> tagList = persistedMember.getTagList();

        // Then
        assertThat(newMember.getName()).isEqualTo("newMember");

        for (Tag tag : tagList) {
            System.out.println("tagList = " + tag);
        }

        assertThat(tagList).hasSize(2); // 태그가 2개인지 확인
        assertThat(tagList.stream().map(Tag::getType))
                .containsExactlyInAnyOrder(TagType.ROOT, TagType.DISCARDED);

//        Optional<Tag> rootTag = tagRepository.findByTypeAndMember(TagType.ROOT, newMember);
//        Optional<Tag> discardedTag = tagRepository.findByTypeAndMember(TagType.DISCARDED, newMember);

//        Optional<Tag> rootTag = tagRepository.findByName("root");
//        Optional<Tag> discardedTag = tagRepository.findByName("discarded");
//
//        assertThat(rootTag).isPresent();
//        assertThat(discardedTag).isPresent();
//
//        assertThat(newMember.getTagList()).containsExactlyInAnyOrder(rootTag.get(), discardedTag.get());
    }

    @Test
    public void checkTagsInDatabase() {
        // Given
        Member newMember = new Member("newMember");
        memberRepository.save(newMember);

        // When
        List<Tag> allTags = tagRepository.findTagListByMemberId(newMember.getId());

        // Then
        assertThat(allTags).hasSize(2); // 태그가 2개인지 확인
        allTags.forEach(tag -> System.out.println("Tag in DB: " + tag.getName()));
    }

    @Test
    public void checkInitDataDefaultTag() {
        //given
        Member member1 = memberRepository.findByName("member1");
        Long memberId = member1.getId();
        List<Tag> tagList = member1.getTagList();
        for (Tag tag : tagList) {
            System.out.println("tag = " + tag);
        }
        //when

        //then
    }

    /*
    h2 Db에서 원래 Member에 List<Tag>나 Tag에서 List<Timer> 테이블에서 안보이나?

     */


}