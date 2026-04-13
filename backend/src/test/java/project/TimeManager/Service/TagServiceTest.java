package project.TimeManager.Service;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.adapter.out.persistence.repository.TagJpaRepository;
import project.TimeManager.application.dto.command.CreateTagCommand;
import project.TimeManager.application.dto.command.MoveTagCommand;
import project.TimeManager.application.dto.command.member.RegisterMemberCommand;
import project.TimeManager.application.service.notification.PushSender;
import project.TimeManager.domain.port.in.member.RegisterMemberUseCase;
import project.TimeManager.domain.port.in.tag.CreateTagUseCase;
import project.TimeManager.domain.port.in.tag.MoveTagUseCase;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.tag.model.TagType;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class TagServiceTest {

    @MockBean PushSender pushSender;
    @Autowired CreateTagUseCase createTagUseCase;
    @Autowired MoveTagUseCase moveTagUseCase;
    @Autowired TagJpaRepository tagJpaRepository;
    @Autowired RegisterMemberUseCase registerMemberUseCase;
    @Autowired EntityManager em;

    private Long registerMember(String name) {
        return registerMemberUseCase.register(
                new RegisterMemberCommand(name, name + "@test.com", "password123")).value();
    }

    @Test
    @DisplayName("태그 생성 시 CUSTOM 타입으로 생성되고, 이름/회원/부모가 올바르게 저장된다")
    void testCreateTag() {
        Long memberId = registerMember("testMember");
        TagJpaEntity rootTag = tagJpaRepository.findByMemberId(memberId).stream()
                .filter(t -> t.getType() == TagType.ROOT).findFirst().orElseThrow();

        Long newTagId = createTagUseCase.createTag(
                new CreateTagCommand("newCreateTag", memberId, rootTag.getId()));

        em.flush();
        em.clear();

        TagJpaEntity newTag = tagJpaRepository.findById(newTagId).orElseThrow();

        assertThat(newTag.getName()).isEqualTo("newCreateTag");
        assertThat(newTag.getType()).isEqualTo(TagType.CUSTOM);
        assertThat(newTag.getMember().getName()).isEqualTo("testMember");
        assertThat(newTag.getParent().getId()).isEqualTo(rootTag.getId());
        assertThat(newTag.getTotalTime()).isZero();
    }

    @Test
    @DisplayName("태그 이동 후 부모가 변경된다")
    void updateParentTagTest() {
        TagJpaEntity childTag1_1 = tagJpaRepository.findAll().stream()
                .filter(t -> t.getName().equals("ChildTag1_1"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("ChildTag1_1이 존재하지 않습니다"));

        TagJpaEntity childTag2 = tagJpaRepository.findAll().stream()
                .filter(t -> t.getName().equals("ChildTag2"))
                .findFirst().orElseThrow();

        moveTagUseCase.moveTag(new MoveTagCommand(childTag1_1.getId(), childTag2.getId(),
                childTag1_1.getMember().getId()));

        em.flush();
        em.clear();

        TagJpaEntity movedTag = tagJpaRepository.findById(childTag1_1.getId()).orElseThrow();
        assertThat(movedTag.getParent().getId()).isEqualTo(childTag2.getId());
    }

    @Test
    @DisplayName("[비즈니스 규칙] 태그를 자기 자신으로 이동하면 서비스에서 예외가 발생한다")
    void moveTagToSelfThrowsFromService() {
        TagJpaEntity anyTag = tagJpaRepository.findAll().stream()
                .filter(t -> t.getType() == TagType.CUSTOM)
                .findFirst()
                .orElseThrow(() -> new AssertionError("CUSTOM 태그가 없습니다"));

        assertThatThrownBy(() ->
                moveTagUseCase.moveTag(new MoveTagCommand(anyTag.getId(), anyTag.getId(),
                        anyTag.getMember().getId()))
        )
                .isInstanceOf(DomainException.class)
                .hasMessageContaining("cannot be moved to itself");
    }
}
