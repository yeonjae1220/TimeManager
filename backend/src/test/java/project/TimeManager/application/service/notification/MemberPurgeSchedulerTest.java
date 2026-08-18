package project.TimeManager.application.service.notification;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import project.TimeManager.domain.port.in.member.PurgeDeletedMembersUseCase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;

/**
 * purge 는 하루 한 번이고 대부분의 날은 지울 대상이 0명이다. 그 날 로그가 통째로 비면
 * "지울 게 없었다"와 "배치가 안 돌았다"가 구분되지 않으므로, 요약은 조건 없이 남겨야 한다.
 */
@ExtendWith(MockitoExtension.class)
class MemberPurgeSchedulerTest {

    @Mock
    private PurgeDeletedMembersUseCase purgeDeletedMembersUseCase;

    @InjectMocks
    private MemberPurgeScheduler scheduler;

    private Logger schedulerLogger;
    private ListAppender<ILoggingEvent> logs;

    @BeforeEach
    void captureLogs() {
        schedulerLogger = (Logger) LoggerFactory.getLogger(MemberPurgeScheduler.class);
        logs = new ListAppender<>();
        logs.start();
        schedulerLogger.addAppender(logs);
    }

    @AfterEach
    void releaseLogs() {
        schedulerLogger.detachAppender(logs);
    }

    private ILoggingEvent onlyLine() {
        assertThat(logs.list).hasSize(1);
        return logs.list.get(0);
    }

    @Test
    @DisplayName("지울 대상이 0명이어도 요약 로그가 남는다")
    void logsSummaryEvenWhenNothingToPurge() {
        given(purgeDeletedMembersUseCase.purgeExpired()).willReturn(0);

        scheduler.purgeExpiredMembers();

        ILoggingEvent line = onlyLine();
        assertThat(line.getLevel()).isEqualTo(Level.INFO);
        assertThat(line.getFormattedMessage()).contains("[Member Purge]").contains("0");
    }

    @Test
    @DisplayName("지운 회원 수를 요약에 남긴다")
    void logsPurgedCount() {
        given(purgeDeletedMembersUseCase.purgeExpired()).willReturn(3);

        scheduler.purgeExpiredMembers();

        assertThat(onlyLine().getFormattedMessage()).contains("3");
    }

    @Test
    @DisplayName("실패는 ERROR 로 남고 스케줄러 밖으로 새어나가지 않는다")
    void failureIsLoggedAndContained() {
        willThrow(new RuntimeException("boom")).given(purgeDeletedMembersUseCase).purgeExpired();

        assertThatCode(() -> scheduler.purgeExpiredMembers()).doesNotThrowAnyException();

        assertThat(onlyLine().getLevel()).isEqualTo(Level.ERROR);
    }
}
