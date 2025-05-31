package project.TimeManager.Service;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.entity.Member;
import project.TimeManager.entity.Tag;
import project.TimeManager.repository.MemberRepository;
import project.TimeManager.repository.TagRepository;

import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;
@SpringBootTest
@Transactional
class TagServiceTest {
    @Autowired
    private TagService tagService;
    @Autowired
    private TagRepository tagRepository;
    @Autowired
    private MemberRepository memberRepository;
    @Autowired
    private EntityManager em;

    @Test
    public void testCreatTag() {
        Member testMember = new Member("testMember");
        Tag parentTag = new Tag("testParentTag");

        // 처음에 Save없는 코드 였고, tagRepository.findById일 때는 그냥 Save없이 해도 정상 작동 되었지만, Id로 바꾸니, 이게 db에 저장되기 전에는 Id값이 null이 들어와서 이렇게 save 해주고 진행하면 오류가 해결됨
        memberRepository.save(testMember);
        tagRepository.save(parentTag);

        Long memberId = testMember.getId();
        Long parentTagId = parentTag.getId();
        System.out.println("memberId = " + memberId + " parentTagId : " + parentTagId);

        Tag newTag = tagRepository.findById(tagService.createTag("newCreateTag", memberId, parentTagId)).get();

        System.out.println("Tag Name: " + newTag.getName());
        System.out.println("Tag Type: " + newTag.getType());
        System.out.println("Member: " + newTag.getMember().getName());
        System.out.println("Parent Tag: " + (newTag.getParent() != null ? newTag.getParent().getName() : "null"));
        System.out.println("Children Tags: " + newTag.getChildren().stream().map(Tag::getName).collect(Collectors.toList()));
        System.out.println("Total Time: " + newTag.getTotalTime());

    }

    @Test
    public void updateParnetTagTest() {
        Tag tag = tagRepository.findByName("ChildTag1_1").get();
        Tag firstParent = tag.getParent();
        Tag SecondParent = firstParent.getParent();
        Tag discardTag = tagRepository.findById(2L).get();

        Tag newParentTage = tagRepository.findByName("ChildTag2").get();

        Member member = tag.getMember();

        System.out.println("ChildTag1_1 totalTime" + tag.getTotalTime());
        System.out.println("ChildTag1 totalTime" + firstParent.getTotalTime());
        System.out.println("ParentTag totalTime" + SecondParent.getTotalTime());
        System.out.println("discardTag totalTime" + discardTag.getTotalTime());
        System.out.println("Child2 totalTime" + newParentTage.getTagTotalTime());

        System.out.println("ChildTag1 Children" + firstParent.getChildren());
        System.out.println("ChildTag2 Children" + newParentTage.getChildren());

        tagService.updateParentTag(tag.getId(), newParentTage.getId());
//        tagService.deleteTag(tag.getId(), discardTag.getId(), member);

        // execute 후 flush clear까지 했는데도 바로 반영이 안됨
        // 벌크 연산은 영속성 컨텍스트(1차 캐시)에 있는 엔티티는 변경되지 않는다고 함
        // 그래서 다시 find로 db에서 조회
        tag = tagRepository.findByName("ChildTag1_1").get();
        firstParent = tagRepository.findByName("ChildTag1").get();
        SecondParent = tagRepository.findByName("ParentTag").get();
        discardTag = tagRepository.findById(2L).get();
        newParentTage = tagRepository.findByName("ChildTag2").get();


        System.out.println("ChildTag1_1 totalTime" + tag.getTotalTime());
        System.out.println("ChildTag1 totalTime" + firstParent.getTotalTime());
        System.out.println("ParentTag totalTime" + SecondParent.getTotalTime());
        System.out.println("discardTag totalTime" + discardTag.getTotalTime());
        System.out.println("ChildTag2 totalTime" + newParentTage.getTotalTime());

        System.out.println("ChildTag1 Children" + firstParent.getChildren());
        System.out.println("ChildTag2 Children" + newParentTage.getChildren());

    }

    // 위의 테스트와 코드가 같은데,org.springframework.dao.DataIntegrityViolationException: could not execute statement [Referential integrity constraint violation: "FKQVOUK265S2XCVJ7RORHA95FKE: PUBLIC.RECORDS FOREIGN KEY(TAG_ID) REFERENCES PUBLIC.TAG(TAG_ID) (CAST(7 AS BIGINT))"; SQL statement:
    // 오류 발생. 이유를 모르겠음
//    @Test
//    public void updateParnetTagTest2 () {
//        Tag tag = tagRepository.findByName("ChildTag1_1").get();
//        Tag parentTag = tag.getParent();
//        Tag newParentTage = tagRepository.findByName("ChildTag2").get();
//
//        Member member = tag.getMember();
//
//        System.out.println("ChildTag1_1 totalTime" + tag.getTotalTime());
//        System.out.println("ChildTag1 totalTime" + parentTag.getTotalTime());
//        System.out.println("ChildTag2 totalTime" + newParentTage.getTotalTime());
//
//        tagService.deleteTag(tag.getId(), newParentTage.getId(), member);
//
//        System.out.println("ChildTag1_1 totalTime" + tag.getTotalTime());
//        System.out.println("ChildTag1 totalTime" + parentTag.getTotalTime());
//        System.out.println("ChildTag2 totalTime" + newParentTage.getTotalTime());
//    }
}