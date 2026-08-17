package project.TimeManager.application.service.command;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.annotation.DirtiesContext;
import project.TimeManager.adapter.out.persistence.entity.RecordJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.adapter.out.persistence.repository.MemberJpaRepository;
import project.TimeManager.adapter.out.persistence.repository.RecordJpaRepository;
import project.TimeManager.adapter.out.persistence.repository.TagJpaRepository;
import project.TimeManager.application.dto.command.CreateTagCommand;
import project.TimeManager.application.dto.command.member.RegisterMemberCommand;
import project.TimeManager.application.service.notification.PushSender;
import project.TimeManager.domain.port.in.member.DeleteMemberUseCase;
import project.TimeManager.domain.port.in.member.RegisterMemberUseCase;
import project.TimeManager.domain.port.in.tag.CreateTagUseCase;
import project.TimeManager.domain.tag.model.TagType;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * 계정 삭제가 그 계정에 딸린 데이터를 실제로 지우는지 검증한다.
 *
 * 단위 테스트로는 잡을 수 없는 결함을 노린다 — 삭제 실패는 서비스 코드가 아니라 DB
 * 외래키 제약에서 나므로, 모킹된 포트로는 항상 통과한다. 그래서 실제 커밋까지 가는
 * 통합 테스트여야 하고(@Transactional 롤백에 기대면 flush 순서가 운영과 달라진다),
 * 커밋하는 만큼 다른 테스트에 데이터를 남기지 않도록 컨텍스트를 정리한다.
 *
 * 공개된 /privacy 문서가 "계정과 함께 태그·기록이 제거된다"고 약속하고 있으므로,
 * 이 테스트는 기능 검증인 동시에 그 약속의 회귀 방지선이다.
 */
@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class DeleteMemberIntegrationTest {

    @MockBean PushSender pushSender;

    @Autowired DeleteMemberUseCase deleteMemberUseCase;
    @Autowired RegisterMemberUseCase registerMemberUseCase;
    @Autowired CreateTagUseCase createTagUseCase;
    @Autowired MemberJpaRepository memberJpaRepository;
    @Autowired TagJpaRepository tagJpaRepository;
    @Autowired RecordJpaRepository recordJpaRepository;

    private static final AtomicInteger SEQ = new AtomicInteger();

    private Long registerMember() {
        int seq = SEQ.incrementAndGet();
        return registerMemberUseCase.register(new RegisterMemberCommand(
                "delMember" + seq, "delete" + seq + "@test.com", "password123")).value();
    }

    private Long rootTagIdOf(Long memberId) {
        return tagJpaRepository.findByMemberId(memberId).stream()
                .filter(t -> t.getType() == TagType.ROOT)
                .findFirst()
                .orElseThrow()
                .getId();
    }

    private Long createRecord(Long tagId) {
        TagJpaEntity tag = tagJpaRepository.findById(tagId).orElseThrow();
        ZonedDateTime start = ZonedDateTime.now().minusHours(1);
        return recordJpaRepository.save(new RecordJpaEntity(tag, start, start.plusMinutes(30))).getId();
    }

    @Test
    @DisplayName("기록이 있는 계정을 삭제하면 태그와 기록이 함께 사라진다")
    void deletesTagsAndRecords() {
        Long memberId = registerMember();
        Long tagId = createTagUseCase.createTag(
                new CreateTagCommand("삭제될 태그", memberId, rootTagIdOf(memberId)));
        Long recordId = createRecord(tagId);

        assertThatCode(() -> deleteMemberUseCase.deleteMember(memberId)).doesNotThrowAnyException();

        assertThat(memberJpaRepository.findById(memberId)).isEmpty();
        assertThat(tagJpaRepository.findByMemberId(memberId)).isEmpty();
        assertThat(recordJpaRepository.findById(recordId))
                .as("기록이 남으면 태그가 사라진 고아 행이 된다")
                .isEmpty();
    }

    @Test
    @DisplayName("하위 태그의 기록까지 지운다 — 태그는 트리라 자식에도 기록이 달린다")
    void deletesRecordsOnChildTags() {
        Long memberId = registerMember();
        Long parentId = createTagUseCase.createTag(
                new CreateTagCommand("부모", memberId, rootTagIdOf(memberId)));
        Long childId = createTagUseCase.createTag(
                new CreateTagCommand("자식", memberId, parentId));
        Long parentRecordId = createRecord(parentId);
        Long childRecordId = createRecord(childId);

        assertThatCode(() -> deleteMemberUseCase.deleteMember(memberId)).doesNotThrowAnyException();

        assertThat(recordJpaRepository.findAllById(List.of(parentRecordId, childRecordId))).isEmpty();
    }

    @Test
    @DisplayName("다른 회원의 태그와 기록은 건드리지 않는다")
    void leavesOtherMembersDataIntact() {
        Long victimId = registerMember();
        Long survivorId = registerMember();
        Long survivorTagId = createTagUseCase.createTag(
                new CreateTagCommand("살아남을 태그", survivorId, rootTagIdOf(survivorId)));
        Long survivorRecordId = createRecord(survivorTagId);
        createRecord(createTagUseCase.createTag(
                new CreateTagCommand("사라질 태그", victimId, rootTagIdOf(victimId))));

        deleteMemberUseCase.deleteMember(victimId);

        assertThat(tagJpaRepository.findById(survivorTagId)).isPresent();
        assertThat(recordJpaRepository.findById(survivorRecordId)).isPresent();
    }
}
