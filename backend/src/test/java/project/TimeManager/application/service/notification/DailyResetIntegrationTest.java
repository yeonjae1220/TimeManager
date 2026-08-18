package project.TimeManager.application.service.notification;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.annotation.DirtiesContext;
import project.TimeManager.adapter.out.persistence.entity.MemberJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.adapter.out.persistence.repository.MemberJpaRepository;
import project.TimeManager.adapter.out.persistence.repository.TagJpaRepository;
import project.TimeManager.application.dto.command.member.RegisterMemberCommand;
import project.TimeManager.domain.port.in.member.RegisterMemberUseCase;
import project.TimeManager.domain.port.out.member.LoadDailyResetTargetsPort;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 따라잡기가 실제로 DB 를 통해 성립하는지 본다.
 *
 * <p>모킹된 포트로는 이 기능의 핵심을 검증할 수 없다 — 따라잡기가 성립하려면 "처리한
 * 경계"가 <b>커밋되어</b> 다음 실행에 보여야 하는데, 목은 아무것도 기억하지 않으므로
 * 마커를 안 쓰는 구현도 단위 테스트를 전부 통과한다.
 *
 * <p>기준 시각은 Asia/Seoul 08-19 05:05(= 08-18T20:05Z), 리셋 시각은 기본값 5시다.
 */
@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class DailyResetIntegrationTest {

    @MockBean PushSender pushSender;

    private static final Instant NOW = Instant.parse("2026-08-18T20:05:00Z");
    private static final Instant TODAY_BOUNDARY = Instant.parse("2026-08-18T20:00:00Z");
    private static final Instant YESTERDAY_BOUNDARY = Instant.parse("2026-08-17T20:00:00Z");

    @Autowired RegisterMemberUseCase registerMemberUseCase;
    @Autowired MemberJpaRepository memberJpaRepository;
    @Autowired TagJpaRepository tagJpaRepository;
    @Autowired MemberDailyResetter memberDailyResetter;
    @Autowired LoadDailyResetTargetsPort loadDailyResetTargetsPort;

    private static final AtomicInteger SEQ = new AtomicInteger();

    private DailyResetScheduler schedulerAt(Instant now) {
        return new DailyResetScheduler(loadDailyResetTargetsPort, memberDailyResetter,
                Clock.fixed(now, ZoneOffset.UTC));
    }

    /** 일일 누적이 쌓여 있고, 마지막 처리 경계가 {@code lastBoundary} 인 회원. */
    private Long memberWithAccumulatedTime(Instant lastBoundary) {
        int seq = SEQ.incrementAndGet();
        Long memberId = registerMemberUseCase.register(
                new RegisterMemberCommand("reset" + seq, "reset" + seq + "@test.com", "password123")).value();

        MemberJpaEntity member = memberJpaRepository.findById(memberId).orElseThrow();
        member.setLastResetBoundaryAt(lastBoundary);
        memberJpaRepository.save(member);

        setAccumulatedTime(memberId, 3_600L);
        return memberId;
    }

    private void setAccumulatedTime(Long memberId, long seconds) {
        for (TagJpaEntity tag : tagJpaRepository.findByMemberId(memberId)) {
            tag.setDailyTotalTime(seconds);
            tag.setDailyElapsedTime(seconds);
            tagJpaRepository.save(tag);
        }
    }

    private long totalDailyTimeOf(Long memberId) {
        return tagJpaRepository.findByMemberId(memberId).stream()
                .mapToLong(TagJpaEntity::getDailyTotalTime)
                .sum();
    }

    private Instant boundaryOf(Long memberId) {
        return memberJpaRepository.findById(memberId).orElseThrow().getLastResetBoundaryAt();
    }

    @Test
    @DisplayName("밀린 경계를 리셋하고, 처리한 경계를 DB 에 남긴다")
    void resetsAndPersistsTheHandledBoundary() {
        Long memberId = memberWithAccumulatedTime(YESTERDAY_BOUNDARY);

        schedulerAt(NOW).resetDailyTimes();

        assertThat(totalDailyTimeOf(memberId)).isZero();
        assertThat(boundaryOf(memberId))
                .as("다음 실행이 같은 경계를 다시 처리하지 않도록 커밋되어야 한다")
                .isEqualTo(TODAY_BOUNDARY);
    }

    @Test
    @DisplayName("같은 경계 안에서 다시 돌아도 두 번 리셋하지 않는다 — 매시 실행의 전제")
    void doesNotResetTwiceWithinTheSameBoundary() {
        Long memberId = memberWithAccumulatedTime(YESTERDAY_BOUNDARY);
        schedulerAt(NOW).resetDailyTimes();

        // 리셋 이후 다시 시간을 쌓는다. 두 번째 실행이 이걸 날리면 안 된다.
        setAccumulatedTime(memberId, 1_200L);
        schedulerAt(NOW.plusSeconds(3600)).resetDailyTimes();

        assertThat(totalDailyTimeOf(memberId))
                .as("경계가 안 바뀌었으므로 리셋 이후 쌓인 시간은 보존되어야 한다")
                .isEqualTo(1_200L * tagJpaRepository.findByMemberId(memberId).size());
    }

    @Test
    @DisplayName("경계 시각이 아닌 때에 돌아도 놓친 경계를 따라잡는다")
    void catchesUpAtANonBoundaryHour() {
        Long memberId = memberWithAccumulatedTime(YESTERDAY_BOUNDARY);

        // 08-19 08:30 KST — 리셋 시각(5시)이 아니다. 예전 구현은 그냥 건너뛰었다.
        schedulerAt(Instant.parse("2026-08-18T23:30:00Z")).resetDailyTimes();

        assertThat(totalDailyTimeOf(memberId)).isZero();
        assertThat(boundaryOf(memberId)).isEqualTo(TODAY_BOUNDARY);
    }

    @Test
    @DisplayName("가입 직후 회원은 첫 경계가 오기 전까지 리셋되지 않는다")
    void brandNewMemberKeepsItsFirstDay() {
        // 오늘 경계(05:00 KST)가 지난 뒤인 07:00 KST 가입
        Long memberId = memberWithAccumulatedTime(Instant.parse("2026-08-18T22:00:00Z"));

        schedulerAt(Instant.parse("2026-08-18T23:30:00Z")).resetDailyTimes();

        assertThat(totalDailyTimeOf(memberId)).isPositive();
    }
}
