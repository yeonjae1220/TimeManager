package project.TimeManager.entity;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.boot.test.mock.mockito.MockBean;
import project.TimeManager.adapter.out.persistence.entity.MemberJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.adapter.out.persistence.repository.MemberJpaRepository;
import project.TimeManager.adapter.out.persistence.repository.TagJpaRepository;
import project.TimeManager.application.dto.command.member.RegisterMemberCommand;
import project.TimeManager.application.service.notification.PushSender;
import project.TimeManager.domain.port.in.member.RegisterMemberUseCase;
import project.TimeManager.domain.tag.model.TagType;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class MemberTest {

    @MockBean PushSender pushSender;
    @Autowired EntityManager em;
    @Autowired MemberJpaRepository memberJpaRepository;
    @Autowired TagJpaRepository tagJpaRepository;
    @Autowired RegisterMemberUseCase registerMemberUseCase;

    private Long registerMember(String name) {
        return registerMemberUseCase.register(
                new RegisterMemberCommand(name, name + "@test.com", "password123")).value();
    }

    @Test
    @DisplayName("회원 생성 시 ROOT 태그와 DISCARDED 태그가 자동 생성된다")
    void createNewMemberWithDefaultTags() {
        Long memberId = registerMember("newMember");

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

    @Test
    @DisplayName("[도메인] Member: 이름이 blank이면 IllegalArgumentException이 발생한다")
    void createMemberWithBlankNameThrows() {
        assertThatThrownBy(() -> registerMemberUseCase.register(
                new RegisterMemberCommand("  ", "any@test.com", "password123")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("회원 이름은 필수입니다");
    }

    @Test
    @DisplayName("[도메인] Member: 이름이 null이면 IllegalArgumentException이 발생한다")
    void createMemberWithNullNameThrows() {
        assertThatThrownBy(() -> registerMemberUseCase.register(
                new RegisterMemberCommand(null, "any@test.com", "password123")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("회원 이름은 필수입니다");
    }
}
