package project.TimeManager.entity;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.adapter.out.persistence.entity.MemberJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.adapter.out.persistence.repository.MemberJpaRepository;
import project.TimeManager.adapter.out.persistence.repository.TagJpaRepository;
import project.TimeManager.application.port.in.member.CreateMemberUseCase;
import project.TimeManager.domain.tag.model.TagType;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class MemberTest {

    @Autowired EntityManager em;
    @Autowired MemberJpaRepository memberJpaRepository;
    @Autowired TagJpaRepository tagJpaRepository;
    @Autowired CreateMemberUseCase createMemberUseCase;

    @Test
    @DisplayName("회원 생성 시 ROOT 태그와 DISCARDED 태그가 자동 생성된다")
    void createNewMemberWithDefaultTags() {
        Long memberId = createMemberUseCase.createMember("newMember");

        MemberJpaEntity member = memberJpaRepository.findById(memberId).orElseThrow();
        List<TagJpaEntity> tagList = tagJpaRepository.findByMemberId(memberId);

        assertThat(member.getName()).isEqualTo("newMember");
        assertThat(tagList).hasSize(2);
        assertThat(tagList.stream().map(TagJpaEntity::getType))
                .containsExactlyInAnyOrder(TagType.ROOT, TagType.DISCARDED);
    }

    @Test
    @DisplayName("InitData로 생성된 member1은 ROOT, DISCARDED 태그를 가진다")
    void checkInitDataDefaultTags() {
        MemberJpaEntity member1 = memberJpaRepository.findAll().stream()
                .filter(m -> m.getName().equals("member1"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("member1이 존재하지 않습니다"));

        List<TagJpaEntity> tags = tagJpaRepository.findByMemberId(member1.getId());

        assertThat(tags.stream().map(TagJpaEntity::getType))
                .contains(TagType.ROOT, TagType.DISCARDED);
    }

    // --- 도메인 불변식 테스트 (Member.create) ---

    @Test
    @DisplayName("[도메인] Member: 이름이 blank이면 IllegalArgumentException이 발생한다")
    void createMemberWithBlankNameThrows() {
        assertThatThrownBy(() -> createMemberUseCase.createMember("  "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("회원 이름은 필수입니다");
    }

    @Test
    @DisplayName("[도메인] Member: 이름이 null이면 IllegalArgumentException이 발생한다")
    void createMemberWithNullNameThrows() {
        assertThatThrownBy(() -> createMemberUseCase.createMember(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("회원 이름은 필수입니다");
    }
}
