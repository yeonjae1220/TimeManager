package project.TimeManager.repository;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.adapter.out.persistence.repository.MemberJpaRepository;
import project.TimeManager.adapter.out.persistence.repository.TagJpaRepository;
import project.TimeManager.domain.tag.model.TagType;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class TagRepositoryTest {

    @Autowired TagJpaRepository tagJpaRepository;
    @Autowired MemberJpaRepository memberJpaRepository;

    @Test
    @DisplayName("전체 태그 수: 2명 × 기본 2개 + 커스텀 4개 = 8개")
    void findAll() {
        List<TagJpaEntity> allTags = tagJpaRepository.findAll();

        assertThat(allTags).hasSize(8);
        assertThat(allTags).extracting("name")
                .containsExactlyInAnyOrder(
                        "root", "discarded",       // member1 기본 태그
                        "root", "discarded",       // member2 기본 태그
                        "ParentTag", "ChildTag1", "ChildTag2", "ChildTag1_1"
                );
    }

    @Test
    @DisplayName("ParentTag의 직계 자식은 ChildTag1, ChildTag2 두 개다")
    void findChildrenByParentId() {
        TagJpaEntity parentTag = tagJpaRepository.findAll().stream()
                .filter(t -> t.getName().equals("ParentTag"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("ParentTag이 존재하지 않습니다"));

        List<TagJpaEntity> children = tagJpaRepository.findAll().stream()
                .filter(t -> t.getParent() != null && t.getParent().getId().equals(parentTag.getId()))
                .toList();

        assertThat(children).hasSize(2);
        assertThat(children).extracting("name")
                .containsExactlyInAnyOrder("ChildTag1", "ChildTag2");
    }

    @Test
    @DisplayName("ParentTag의 totalTime은 하위 전체 기록의 합산 값이다")
    void checkTotalTime() {
        TagJpaEntity parentTag = tagJpaRepository.findAll().stream()
                .filter(t -> t.getName().equals("ParentTag"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("ParentTag이 존재하지 않습니다"));

        // totalTime: 하위 전체 배치 누적 (t1=3600 + t2=7800 + t3=1800 + t4=1200 = 14400)
        assertThat(parentTag.getTotalTime()).isEqualTo(14400L);
        // tagTotalTime: ParentTag에 직접 생성된 기록만 (t1=3600 + t2=7800 = 11400)
        assertThat(parentTag.getTagTotalTime()).isEqualTo(11400L);
    }

    @Test
    @DisplayName("findByMemberId로 특정 회원의 태그만 조회된다")
    void findByMemberId() {
        Long member1Id = memberJpaRepository.findAll().stream()
                .filter(m -> m.getName().equals("member1"))
                .findFirst().orElseThrow().getId();

        List<TagJpaEntity> member1Tags = tagJpaRepository.findByMemberId(member1Id);

        assertThat(member1Tags).hasSize(6); // root + discarded + ParentTag + ChildTag1 + ChildTag2 + ChildTag1_1
        assertThat(member1Tags).extracting("name")
                .containsExactlyInAnyOrder("root", "discarded", "ParentTag", "ChildTag1", "ChildTag2", "ChildTag1_1");
    }
}
