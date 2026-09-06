package project.TimeManager.application.service.command;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.annotation.DirtiesContext;
import project.TimeManager.adapter.out.persistence.repository.TagJpaRepository;
import project.TimeManager.application.dto.command.CreateTagCommand;
import project.TimeManager.application.dto.command.StartTimerCommand;
import project.TimeManager.application.dto.command.StopTimerCommand;
import project.TimeManager.application.dto.command.member.RegisterMemberCommand;
import project.TimeManager.application.dto.result.RecordResult;
import project.TimeManager.application.service.notification.PushSender;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.port.in.member.RegisterMemberUseCase;
import project.TimeManager.domain.port.in.record.DeleteRecordUseCase;
import project.TimeManager.domain.port.in.tag.CreateTagUseCase;
import project.TimeManager.domain.port.in.tag.StartTimerUseCase;
import project.TimeManager.domain.port.in.tag.StopTimerUseCase;
import project.TimeManager.domain.port.out.record.LoadRecordsByTagPort;
import project.TimeManager.domain.tag.model.TagType;

import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 실제로 발생한 사고의 전 과정 재현.
 * <p>
 * 데스크탑 탭에서 시작한 타이머를 끄지 않은 채 PWA 에서 정지 → 그 기록을 삭제 →
 * 아직 "실행 중"으로 보이던 데스크탑에서 정지 → <b>2:13 ~ 다음날 12:10 (약 34시간)</b>
 * 짜리 기록이 새로 생겼다.
 * <p>
 * 목 기반 단위 테스트로는 이 연쇄를 증명할 수 없다 — 기록 삭제가 태그 파생 필드를
 * 되돌리는 부분이 실제 조회·저장을 거치기 때문이다. 그래서 실DB 를 통과시킨다.
 */
@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@DisplayName("유령 정지 기록")
class PhantomStopRecordIntegrationTest {

    @MockBean PushSender pushSender;

    @Autowired RegisterMemberUseCase registerMemberUseCase;
    @Autowired CreateTagUseCase createTagUseCase;
    @Autowired TagJpaRepository tagJpaRepository;
    @Autowired StartTimerUseCase startTimerUseCase;
    @Autowired StopTimerUseCase stopTimerUseCase;
    @Autowired DeleteRecordUseCase deleteRecordUseCase;
    @Autowired LoadRecordsByTagPort loadRecordsByTagPort;

    private static final AtomicInteger SEQ = new AtomicInteger();
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    /**
     * 클라이언트는 `new Date(x).toISOString()` 으로 <b>밀리초</b> 정밀도만 보낸다.
     * 테스트가 {@code ZonedDateTime.now()} 의 나노초를 그대로 쓰면 DB(마이크로초)에서
     * 반올림돼 서버 앵커가 클라이언트 값과 수백 ns 어긋나고, {@code Duration.toSeconds()} 의
     * 절삭 때문에 기록 길이가 1초씩 오락가락하는 <b>현실에 없는</b> 실패가 난다.
     * 실제 요청과 같은 정밀도로 맞춰 그 인공물을 제거한다.
     */
    private static ZonedDateTime now() {
        return ZonedDateTime.now(SEOUL).truncatedTo(ChronoUnit.MILLIS);
    }

    private Long memberId;
    private Long tagId;

    @BeforeEach
    void setUp() {
        int seq = SEQ.incrementAndGet();
        memberId = registerMemberUseCase.register(new RegisterMemberCommand(
                "phantom" + seq, "phantom" + seq + "@test.com", "password123")).value();
        Long rootId = tagJpaRepository.findByMemberId(memberId).stream()
                .filter(t -> t.getType() == TagType.ROOT)
                .findFirst().orElseThrow()
                .getId();
        tagId = createTagUseCase.createTag(new CreateTagCommand("빅분기", memberId, rootId));
    }

    @Test
    @DisplayName("PWA 가 정지하고 기록을 지운 뒤, 옛 시작시각을 든 데스크탑이 정지해도 유령 기록이 생기지 않는다")
    void staleDeviceStop_afterOtherDeviceStoppedAndRecordDeleted_createsNoPhantomRecord() {
        ZonedDateTime startedAt = now().minusHours(10);
        ZonedDateTime pwaStoppedAt = startedAt.plusHours(1);

        // ① 데스크탑에서 시작
        startTimerUseCase.startTimer(new StartTimerCommand(tagId, startedAt, memberId));

        // ② PWA 에서 정지 — 기록 1건 생성
        Long recordId = stopTimerUseCase.stopTimer(
                new StopTimerCommand(tagId, 3600L, startedAt, pwaStoppedAt, memberId));
        assertThat(loadRecordsByTagPort.loadRecordsByTagId(tagId)).hasSize(1);

        // ③ PWA 에서 그 기록 삭제
        assertThat(deleteRecordUseCase.deleteRecord(recordId, memberId)).isTrue();
        assertThat(loadRecordsByTagPort.loadRecordsByTagId(tagId)).isEmpty();

        // ④ 데스크탑 탭은 아직 "실행 중"으로 보이고, 옛 시작시각(startedAt)을 든 채 정지를 누른다
        ZonedDateTime desktopStopsAt = now();
        assertThatThrownBy(() -> stopTimerUseCase.stopTimer(new StopTimerCommand(
                tagId, 122_000L, startedAt, desktopStopsAt, memberId)))
                .isInstanceOf(DomainException.class);

        // 34시간짜리 유령 기록이 생기면 안 된다.
        assertThat(loadRecordsByTagPort.loadRecordsByTagId(tagId))
                .as("이미 닫힌 세션을 다시 정지시켜 기록이 부활하면 안 된다")
                .isEmpty();
    }

    @Test
    @DisplayName("[정상동작] 시작 → 정지의 평범한 흐름은 그대로 기록된다")
    void normalStartStop_stillRecordsSession() {
        ZonedDateTime startedAt = now().minusMinutes(30);
        ZonedDateTime stoppedAt = startedAt.plusMinutes(30);

        startTimerUseCase.startTimer(new StartTimerCommand(tagId, startedAt, memberId));
        stopTimerUseCase.stopTimer(new StopTimerCommand(tagId, 1800L, startedAt, stoppedAt, memberId));

        List<RecordResult> records = loadRecordsByTagPort.loadRecordsByTagId(tagId);
        assertThat(records).hasSize(1);
        assertThat(records.get(0).getTotalTime()).isEqualTo(1800L);
    }

    @Test
    @DisplayName("[정상동작] 정지 후 다시 시작해 정지하면 두 번째 세션도 정상 기록된다")
    void secondSessionAfterStop_isRecorded() {
        ZonedDateTime first = now().minusHours(3);
        startTimerUseCase.startTimer(new StartTimerCommand(tagId, first, memberId));
        stopTimerUseCase.stopTimer(new StopTimerCommand(tagId, 1800L, first, first.plusMinutes(30), memberId));

        ZonedDateTime second = first.plusHours(1);
        startTimerUseCase.startTimer(new StartTimerCommand(tagId, second, memberId));
        stopTimerUseCase.stopTimer(new StopTimerCommand(tagId, 1800L, second, second.plusMinutes(30), memberId));

        assertThat(loadRecordsByTagPort.loadRecordsByTagId(tagId))
                .as("이후 정상 세션까지 막히면 안 된다")
                .hasSize(2);
    }

    @Test
    @DisplayName("[오프라인] 서버가 start 를 못 받은 채 stop 만 도착해도, 마지막 세션 이후 구간이면 기록된다")
    void offlineSessionWithoutServerStart_isStillRecorded() {
        // 과거 세션 1건으로 latestStopTime 을 만들어 둔다.
        ZonedDateTime past = now().minusHours(5);
        startTimerUseCase.startTimer(new StartTimerCommand(tagId, past, memberId));
        stopTimerUseCase.stopTimer(new StopTimerCommand(tagId, 1800L, past, past.plusMinutes(30), memberId));

        // 오프라인에서 start 가 큐에 남아 서버에 안 닿은 채, 온라인 복귀 후 stop 만 도착.
        ZonedDateTime offlineStart = past.plusHours(1);
        stopTimerUseCase.stopTimer(new StopTimerCommand(
                tagId, 600L, offlineStart, offlineStart.plusMinutes(10), memberId));

        assertThat(loadRecordsByTagPort.loadRecordsByTagId(tagId))
                .as("오프라인 세션이 조용히 사라지면 안 된다")
                .hasSize(2);
    }
}
