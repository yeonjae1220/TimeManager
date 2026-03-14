package project.TimeManager.entity;

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
import project.TimeManager.application.dto.command.member.RegisterMemberCommand;
import project.TimeManager.application.service.notification.PushSender;
import project.TimeManager.domain.port.in.member.RegisterMemberUseCase;
import project.TimeManager.domain.port.in.tag.CreateTagUseCase;
import project.TimeManager.domain.tag.model.TagType;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class TagTest {

    @MockBean PushSender pushSender;
    @Autowired EntityManager em;
    @Autowired TagJpaRepository tagJpaRepository;
    @Autowired RegisterMemberUseCase registerMemberUseCase;
    @Autowired CreateTagUseCase createTagUseCase;

    private Long registerMember(String name) {
        return registerMemberUseCase.register(
                new RegisterMemberCommand(name, name + "@test.com", "password123")).value();
    }

    @Test
    @DisplayName("태그 생성 후 부모-자식 관계가 올바르게 설정된다")
    void EntitySetParentChild() {
        Long memberId = registerMember("tagTestMember");
        Long rootId = tagJpaRepository.findByMemberId(memberId).stream()
                .filter(t -> t.getType() == TagType.ROOT)
                .findFirst().orElseThrow().getId();

        Long tag1Id = createTagUseCase.createTag(new CreateTagCommand("tag1", memberId, rootId));
        Long tag1_1Id = createTagUseCase.createTag(new CreateTagCommand("tag1_1", memberId, tag1Id));

        em.flush();
        em.clear();

        TagJpaEntity tag1 = tagJpaRepository.findById(tag1Id).orElseThrow();
        TagJpaEntity tag1_1 = tagJpaRepository.findById(tag1_1Id).orElseThrow();

        assertThat(tag1.getChildren()).extracting("id").contains(tag1_1Id);
        assertThat(tag1_1.getParent().getId()).isEqualTo(tag1Id);
    }
}
