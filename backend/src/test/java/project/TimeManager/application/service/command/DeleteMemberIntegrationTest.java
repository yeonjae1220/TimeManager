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
import project.TimeManager.domain.port.in.member.PurgeDeletedMembersUseCase;
import project.TimeManager.domain.port.in.member.RegisterMemberUseCase;
import project.TimeManager.domain.port.in.tag.CreateTagUseCase;
import project.TimeManager.domain.port.out.auth.LoadMemberCredentialsPort;
import project.TimeManager.domain.port.out.member.LoadMemberPort;
import project.TimeManager.domain.port.out.tag.LoadTagPort;
import project.TimeManager.domain.tag.model.TagType;
import project.TimeManager.domain.tag.model.TimerState;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * 계정 삭제(소프트) 와 유예 만료 후 완전 삭제(purge) 를 검증한다.
 *
 * 단위 테스트로는 잡을 수 없는 결함을 노린다 — 완전 삭제 실패는 서비스 코드가 아니라
 * DB 외래키 제약에서 나므로 모킹된 포트로는 항상 통과한다. 그래서 실제 커밋까지 가는
 * 통합 테스트여야 하고(@Transactional 롤백에 기대면 flush 순서가 운영과 달라진다),
 * 커밋하는 만큼 다른 테스트에 데이터를 남기지 않도록 컨텍스트를 정리한다.
 *
 * 공개된 /privacy 문서가 "30일 유예 후 완전 삭제" 를 약속하므로,
 * 이 테스트는 기능 검증인 동시에 그 약속의 회귀 방지선이다.
 */
@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class DeleteMemberIntegrationTest {

    @MockBean PushSender pushSender;

    @Autowired DeleteMemberUseCase deleteMemberUseCase;
    @Autowired PurgeDeletedMembersUseCase purgeDeletedMembersUseCase;
    @Autowired RegisterMemberUseCase registerMemberUseCase;
    @Autowired CreateTagUseCase createTagUseCase;
    @Autowired LoadMemberPort loadMemberPort;
    @Autowired LoadMemberCredentialsPort loadMemberCredentialsPort;
    @Autowired MemberJpaRepository memberJpaRepository;
    @Autowired TagJpaRepository tagJpaRepository;
    @Autowired RecordJpaRepository recordJpaRepository;
    @Autowired LoadTagPort loadTagPort;

    private static final AtomicInteger SEQ = new AtomicInteger();

    private record Fixture(Long memberId, String email, Long tagId, Long recordId) {}

    private Fixture register() {
        int seq = SEQ.incrementAndGet();
        String email = "delete" + seq + "@test.com";
        Long memberId = registerMemberUseCase
                .register(new RegisterMemberCommand("delMember" + seq, email, "password123")).value();
        Long tagId = createTagUseCase.createTag(
                new CreateTagCommand("태그" + seq, memberId, rootTagIdOf(memberId)));
        return new Fixture(memberId, email, tagId, createRecord(tagId));
    }

    private Long rootTagIdOf(Long memberId) {
        return tagJpaRepository.findByMemberId(memberId).stream()
                .filter(t -> t.getType() == TagType.ROOT)
                .findFirst().orElseThrow().getId();
    }

    private Long createRecord(Long tagId) {
        TagJpaEntity tag = tagJpaRepository.findById(tagId).orElseThrow();
        var start = java.time.ZonedDateTime.now().minusHours(1);
        return recordJpaRepository.save(new RecordJpaEntity(tag, start, start.plusMinutes(30))).getId();
    }

    /** 유예 기간이 지난 것처럼 보이게 삭제 시각을 과거로 민다. */
    private void backdateDeletion(Long memberId, LocalDateTime when) {
        var entity = memberJpaRepository.findById(memberId).orElseThrow();
        entity.setDeletedAt(when);
        memberJpaRepository.save(entity);
    }

    // ===== 소프트 삭제 =====

    @Test
    @DisplayName("삭제하면 회원을 더 이상 조회할 수 없다 — 이것이 모든 읽기 경로를 막는 관문이다")
    void softDeletedMemberIsNotLoadable() {
        Fixture f = register();

        deleteMemberUseCase.deleteMember(f.memberId());

        assertThat(loadMemberPort.loadMember(f.memberId())).isEmpty();
        assertThat(loadMemberPort.findMemberByEmail(f.email())).isEmpty();
        assertThat(loadMemberCredentialsPort.findByEmail(f.email()))
                .as("로그인 경로가 삭제된 계정을 찾으면 안 된다")
                .isEmpty();
    }

    @Test
    @DisplayName("삭제해도 행은 남는다 — 유예 기간 동안 복구할 수 있어야 한다")
    void softDeleteKeepsRowsForGracePeriod() {
        Fixture f = register();

        deleteMemberUseCase.deleteMember(f.memberId());

        assertThat(memberJpaRepository.findById(f.memberId()))
                .as("물리 행은 유예 기간 동안 살아 있다")
                .isPresent();
        assertThat(tagJpaRepository.findById(f.tagId())).isPresent();
        assertThat(recordJpaRepository.findById(f.recordId())).isPresent();
    }

    @Test
    @DisplayName("삭제 시 이메일을 봉인해 같은 주소로 즉시 재가입할 수 있다")
    void deletionSealsEmailSoItCanBeReused() {
        Fixture f = register();

        deleteMemberUseCase.deleteMember(f.memberId());

        var sealed = memberJpaRepository.findById(f.memberId()).orElseThrow();
        assertThat(sealed.getEmail())
                .as("unique 제약을 비켜야 재가입이 가능하다")
                .isNotEqualTo(f.email())
                .contains(f.email());

        assertThatCode(() -> registerMemberUseCase.register(
                new RegisterMemberCommand("다시가입", f.email(), "password123")))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("이미 삭제된 회원을 다시 삭제해도 조용히 지나간다 — 재시도가 깨지면 안 된다")
    void deletingTwiceIsIdempotent() {
        Fixture f = register();
        deleteMemberUseCase.deleteMember(f.memberId());

        assertThatCode(() -> deleteMemberUseCase.deleteMember(f.memberId()))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("관리자 목록과 집계에서 삭제된 회원이 빠진다")
    void softDeletedMemberIsExcludedFromAdminViews() {
        Fixture f = register();
        long before = loadMemberPort.count();

        deleteMemberUseCase.deleteMember(f.memberId());

        assertThat(loadMemberPort.count()).isEqualTo(before - 1);
        assertThat(loadMemberPort.loadAllMembers())
                .extracting(m -> m.getId().value())
                .doesNotContain(f.memberId());
    }

    @Test
    @DisplayName("관리자 '실행중 타이머' 뷰에서도 삭제된 회원의 태그가 빠진다")
    void softDeletedMemberRunningTagsAreExcluded() {
        Fixture f = register();
        startTimer(f.tagId());
        assertThat(loadTagPort.findAllRunningTags())
                .as("삭제 전에는 보여야 대조가 성립한다")
                .extracting(t -> t.getId().value())
                .contains(f.tagId());

        deleteMemberUseCase.deleteMember(f.memberId());

        // 이 조회는 태그에서 출발해 회원을 조인하므로 MemberPersistenceAdapter 관문을 지나지 않는다.
        // 별도로 걸러주지 않으면 회원 목록에는 없는 회원의 타이머가 관리자 화면에만 남는다.
        assertThat(loadTagPort.findAllRunningTags())
                .extracting(t -> t.getId().value())
                .doesNotContain(f.tagId());
    }

    /** 도메인 흐름을 거치지 않고 실행중 상태만 만든다 — 여기서 검증할 것은 타이머가 아니라 가시성이다. */
    private void startTimer(Long tagId) {
        TagJpaEntity tag = tagJpaRepository.findById(tagId).orElseThrow();
        tag.setTimerState(TimerState.RUNNING);
        tag.setLatestStartTime(java.time.ZonedDateTime.now().minusMinutes(5));
        tagJpaRepository.save(tag);
    }

    // ===== 유예 만료 후 완전 삭제 =====

    @Test
    @DisplayName("유예가 지난 계정은 태그·기록까지 물리적으로 사라진다")
    void purgeRemovesEverythingAfterGrace() {
        Fixture f = register();
        deleteMemberUseCase.deleteMember(f.memberId());
        backdateDeletion(f.memberId(), LocalDateTime.now().minusDays(31));

        int purged = purgeDeletedMembersUseCase.purgeExpired();

        assertThat(purged).isGreaterThanOrEqualTo(1);
        assertThat(memberJpaRepository.findById(f.memberId())).isEmpty();
        assertThat(tagJpaRepository.findById(f.tagId())).isEmpty();
        assertThat(recordJpaRepository.findById(f.recordId()))
                .as("기록이 남으면 태그가 사라진 고아 행이 된다")
                .isEmpty();
    }

    @Test
    @DisplayName("하위 태그의 기록까지 지운다 — 태그는 트리라 자식에도 기록이 달린다")
    void purgeRemovesRecordsOnChildTags() {
        Fixture f = register();
        Long childId = createTagUseCase.createTag(new CreateTagCommand("자식", f.memberId(), f.tagId()));
        Long childRecordId = createRecord(childId);

        deleteMemberUseCase.deleteMember(f.memberId());
        backdateDeletion(f.memberId(), LocalDateTime.now().minusDays(31));
        purgeDeletedMembersUseCase.purgeExpired();

        assertThat(recordJpaRepository.findAllById(List.of(f.recordId(), childRecordId))).isEmpty();
    }

    @Test
    @DisplayName("유예 기간이 남은 계정은 건드리지 않는다")
    void purgeSkipsMembersStillInGrace() {
        Fixture f = register();
        deleteMemberUseCase.deleteMember(f.memberId());
        backdateDeletion(f.memberId(), LocalDateTime.now().minusDays(3));

        purgeDeletedMembersUseCase.purgeExpired();

        assertThat(memberJpaRepository.findById(f.memberId())).isPresent();
        assertThat(recordJpaRepository.findById(f.recordId())).isPresent();
    }

    @Test
    @DisplayName("삭제하지 않은 회원은 절대 purge 대상이 아니다")
    void purgeNeverTouchesLiveMembers() {
        Fixture live = register();
        Fixture doomed = register();
        deleteMemberUseCase.deleteMember(doomed.memberId());
        backdateDeletion(doomed.memberId(), LocalDateTime.now().minusDays(31));

        purgeDeletedMembersUseCase.purgeExpired();

        assertThat(memberJpaRepository.findById(live.memberId())).isPresent();
        assertThat(tagJpaRepository.findById(live.tagId())).isPresent();
        assertThat(recordJpaRepository.findById(live.recordId())).isPresent();
        assertThat(memberJpaRepository.findById(doomed.memberId())).isEmpty();
    }
}
