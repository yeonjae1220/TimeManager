package project.TimeManager.repository;

import com.querydsl.jpa.impl.JPAQueryFactory;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.entity.Tag;


import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class TagRepositoryTest {
    @Autowired
    private TagRepository tagRepository;
    @Autowired
    private EntityManager em;
    @Autowired
    private JPAQueryFactory jpaQueryFactory;

//    @BeforeEach
//    void setup() {
//        Tag parentTag = new Tag("ParentTag");
//        tagRepository.save(parentTag);
//        Tag childTag1 = new Tag("ChildTag1", parentTag);
//        tagRepository.save(childTag1);
//        Tag childTag2 = new Tag("ChildTag2", parentTag);
//        tagRepository.save(childTag2);
//        Tag childTag1_1 = new Tag("ChildTag1_1", childTag1);
//        tagRepository.save(childTag1_1);
//r
//        // 영속성 컨텍스트 비우기 (캐시 방지)
//        em.flush();
//        em.clear();
//    }


    @Test
    public void findChildrenByParentId() {
        //given
        Optional<Tag> optionalParentTag = tagRepository.findByName("ParentTag"); // 부모 태그 조회
        assertThat(optionalParentTag).isPresent();

        Tag parentTag = optionalParentTag.get(); // Optional에서 값 가져오기

        // When
        List<Tag> children = tagRepository.findByParentId(parentTag.getId());

          /*
        이 방식으로 코드를 작성하면 get()을 호출하지 않고도 Optional의 값을 안전하게 사용할 수 있습니다. ifPresent()를 활용해 Optional이 비어있을 때 아무런 동작도 하지 않게 만들거나, orElseThrow()를 사용해 값이 없을 때 예외를 던질 수 있습니다.
        optionalParentTag.ifPresent(parentTag -> {
            List<Tag> children = tagRepository.findChildrenByParentId(parentTag.getId());
         */

        // Then
        assertThat(children).hasSize(2);
        assertThat(children).extracting("name").containsExactlyInAnyOrder("ChildTag1", "ChildTag2");
        }


    @Test
    public void findAll() {
        List<Tag> allTag = tagRepository.findAll();
        assertThat(allTag).extracting("name").containsExactlyInAnyOrder("root", "discarded", "root", "discarded","ParentTag", "ChildTag1", "ChildTag2", "ChildTag1_1");
        // 맴버 2개가 있음, 디폴트로 2개씩 생긴 것 추가
    }

    @Test
    public void checkTotalTime() {
        // given
        Tag ParentTag = tagRepository.findByName("ParentTag").get(); // 부모 태그 조회
        System.out.println("totalTime : " + ParentTag.getTagTotalTime());
        assertThat(ParentTag.getTagTotalTime()).isNotEqualTo(0L);
    }

}
