package project.TimeManager.application.service.command;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.annotation.DirtiesContext;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.adapter.out.persistence.repository.MemberJpaRepository;
import project.TimeManager.adapter.out.persistence.repository.TagJpaRepository;
import project.TimeManager.application.dto.command.CreateTagCommand;
import project.TimeManager.application.dto.command.StartTimerCommand;
import project.TimeManager.application.dto.command.member.RegisterMemberCommand;
import project.TimeManager.application.service.notification.PushSender;
import project.TimeManager.domain.port.in.member.RegisterMemberUseCase;
import project.TimeManager.domain.port.in.tag.CreateTagUseCase;
import project.TimeManager.domain.port.in.tag.ReconcileRunningTimersUseCase;
import project.TimeManager.domain.port.in.tag.StartTimerUseCase;
import project.TimeManager.domain.tag.model.TagType;
import project.TimeManager.domain.tag.model.TimerState;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 두 "기기"가 거의 동시에 같은 회원의 타이머를 조작하는 레이스 컨디션 재현.
 * 실제 서비스는 요청마다 별도 스레드·DB 커넥션을 쓰므로, Mockito 기반 단위 테스트로는
 * 진짜 레이스를 만들 수 없다 — CyclicBarrier로 스레드를 강제 동기화해 실제 동시 커밋을 재현한다.
 *
 * 이 클래스는 (동시성 재현을 위해) 트랜잭션 롤백에 기대지 않고 실제로 커밋하므로,
 * InitTestData가 심어둔 기준 데이터(member1/member2 등)를 다른 테스트 클래스가
 * 오염된 상태로 물려받지 않도록 클래스 종료 후 Spring 컨텍스트를 강제로 새로 띄운다.
 */
@SpringBootTest
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class TimerConcurrencyIntegrationTest {

    @MockBean PushSender pushSender;
    @Autowired StartTimerUseCase startTimerUseCase;
    @Autowired ReconcileRunningTimersUseCase reconcileRunningTimersUseCase;
    @Autowired RegisterMemberUseCase registerMemberUseCase;
    @Autowired CreateTagUseCase createTagUseCase;
    @Autowired TagJpaRepository tagJpaRepository;
    @Autowired MemberJpaRepository memberJpaRepository;

    private static final AtomicInteger SEQ = new AtomicInteger();

    private Long memberId;
    private Long tagAId;
    private Long tagBId;

    @BeforeEach
    void setUp() {
        int seq = SEQ.incrementAndGet();
        memberId = registerMemberUseCase.register(
                new RegisterMemberCommand("raceMember" + seq, "race" + seq + "@test.com", "password123")).value();
        Long rootId = tagJpaRepository.findByMemberId(memberId).stream()
                .filter(t -> t.getType() == TagType.ROOT)
                .findFirst().orElseThrow()
                .getId();
        tagAId = createTagUseCase.createTag(new CreateTagCommand("DeviceTagA", memberId, rootId));
        tagBId = createTagUseCase.createTag(new CreateTagCommand("DeviceTagB", memberId, rootId));
    }

    private StartTimerCommand startCommand(Long tagId) {
        return new StartTimerCommand(tagId, ZonedDateTime.now(ZoneId.systemDefault()), memberId);
    }

    private List<TagJpaEntity> runningTagsOfMember() {
        return tagJpaRepository.findByMemberId(memberId).stream()
                .filter(t -> t.getTimerState() == TimerState.RUNNING)
                .toList();
    }

    @Test
    @DisplayName("[동시start·같은태그] 같은 태그에 여러 기기가 동시에 start해도 최종적으로 정확히 1개의 RUNNING으로 수렴한다")
    void concurrentStartOnSameTag_convergesToSingleRunningState() throws Exception {
        int threadCount = 8;
        ExecutorService pool = Executors.newFixedThreadPool(threadCount);
        CyclicBarrier barrier = new CyclicBarrier(threadCount);

        List<Future<Boolean>> results = IntStream.range(0, threadCount)
                .mapToObj(i -> pool.submit(() -> {
                    barrier.await();
                    try {
                        startTimerUseCase.startTimer(startCommand(tagAId));
                        return true;
                    } catch (Exception e) {
                        // 낙관적 락 충돌 등으로 진 요청 — 누가 이겼는지는 최종 DB 상태로 검증한다
                        return false;
                    }
                }))
                .toList();

        pool.shutdown();
        assertThat(pool.awaitTermination(10, TimeUnit.SECONDS)).isTrue();

        long succeeded = results.stream()
                .filter(f -> {
                    try {
                        return f.get();
                    } catch (Exception e) {
                        return false;
                    }
                })
                .count();
        assertThat(succeeded).isGreaterThanOrEqualTo(1);

        List<TagJpaEntity> running = runningTagsOfMember();
        assertThat(running).hasSize(1);
        assertThat(running.get(0).getId()).isEqualTo(tagAId);
    }

    private void forceRunning(Long tagId, ZonedDateTime latestStartTime) {
        TagJpaEntity entity = tagJpaRepository.findById(tagId).orElseThrow();
        entity.setTimerState(TimerState.RUNNING);
        entity.setLatestStartTime(latestStartTime);
        tagJpaRepository.save(entity);
    }

    @Test
    @DisplayName("[동시start·다른태그·읽기화해] 동시 start로 다중 RUNNING이 생겨도, 읽기 경로 화해(reconcile)가 최신 1개로 수렴시킨다")
    void concurrentStartOnDifferentTags_reconciledToSingleRunning() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CyclicBarrier barrier = new CyclicBarrier(2);

        Future<?> deviceA = pool.submit(() -> {
            barrier.await();
            startTimerUseCase.startTimer(startCommand(tagAId));
            return null;
        });
        Future<?> deviceB = pool.submit(() -> {
            barrier.await();
            startTimerUseCase.startTimer(startCommand(tagBId));
            return null;
        });

        deviceA.get(10, TimeUnit.SECONDS);
        deviceB.get(10, TimeUnit.SECONDS);
        pool.shutdown();
        assertThat(pool.awaitTermination(10, TimeUnit.SECONDS)).isTrue();

        // 안0: 동시 start 레이스는 서버에 다중 RUNNING을 남길 수 있다(허용된 한계, 락으로 막지 않음).
        // 대신 읽기 경로(태그 목록·상세 조회)에서 호출되는 reconcile이 이를 최신 1개로 치유한다.
        reconcileRunningTimersUseCase.reconcile(memberId);

        List<TagJpaEntity> running = runningTagsOfMember();
        assertThat(running)
                .as("읽기 화해 후에는 두 기기가 동일한 '현재 실행 중' 1개만 보게 된다")
                .hasSize(1);
    }

    @Test
    @DisplayName("[다중RUNNING·결정적] 이미 2개가 RUNNING이면 reconcile이 가장 최근에 시작된 태그만 남기고 정지시킨다")
    void reconcile_multipleRunning_keepsLatestStopsRest() {
        // 과거 결함/레이스로 두 태그가 동시에 RUNNING인 상태를 직접 재현
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        forceRunning(tagAId, now.minusHours(2));   // 패자(오래된 시작)
        forceRunning(tagBId, now.minusMinutes(1)); // 승자(최신 시작)

        reconcileRunningTimersUseCase.reconcile(memberId);

        List<TagJpaEntity> running = runningTagsOfMember();
        assertThat(running).hasSize(1);
        assertThat(running.get(0).getId())
                .as("최신 시작(tagB)이 승자로 남아야 한다 — last-write-wins")
                .isEqualTo(tagBId);
    }
}
