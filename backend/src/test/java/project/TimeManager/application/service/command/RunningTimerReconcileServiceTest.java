package project.TimeManager.application.service.command;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import project.TimeManager.domain.member.model.MemberId;
import project.TimeManager.domain.port.out.tag.LoadTagPort;
import project.TimeManager.domain.port.out.tag.SaveTagPort;
import project.TimeManager.domain.tag.model.Tag;
import project.TimeManager.domain.tag.model.TagId;
import project.TimeManager.domain.tag.model.TagType;
import project.TimeManager.domain.tag.model.TimerState;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;

@ExtendWith(MockitoExtension.class)
@DisplayName("RunningTimerReconcileService — 다중 RUNNING 읽기 화해")
class RunningTimerReconcileServiceTest {

    @Mock LoadTagPort loadTagPort;
    @Mock SaveTagPort saveTagPort;

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final Long MEMBER_ID = 7L;

    private RunningTimerReconcileService service;

    @BeforeEach
    void setUp() {
        service = new RunningTimerReconcileService(loadTagPort, saveTagPort);
    }

    private Tag runningTag(Long tagId, ZonedDateTime latestStartTime, long elapsed) {
        return Tag.reconstitute(
                TagId.of(tagId), "Tag" + tagId, TagType.CUSTOM,
                elapsed, 0L, 0L, 0L, 0L, 0L,
                latestStartTime, ZonedDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneId.systemDefault()),
                TimerState.RUNNING, MemberId.of(MEMBER_ID), null);
    }

    @Test
    @DisplayName("RUNNING이 없으면 아무 것도 저장하지 않는다")
    void noRunning_noWrite() {
        given(loadTagPort.findRunningTagsByMemberId(MEMBER_ID)).willReturn(List.of());

        service.reconcile(MEMBER_ID);

        then(saveTagPort).should(never()).saveTag(any());
    }

    @Test
    @DisplayName("RUNNING이 정확히 1개면(정상) 아무 것도 저장하지 않는다")
    void singleRunning_noWrite() {
        given(loadTagPort.findRunningTagsByMemberId(MEMBER_ID))
                .willReturn(List.of(runningTag(1L, ZonedDateTime.now(SEOUL), 0L)));

        service.reconcile(MEMBER_ID);

        then(saveTagPort).should(never()).saveTag(any());
    }

    @Test
    @DisplayName("RUNNING이 2개 이상이면 가장 최근에 시작된 태그만 남기고 나머지를 정지·저장한다")
    void multipleRunning_keepsLatestStopsRest() {
        ZonedDateTime now = ZonedDateTime.now(SEOUL);
        Tag older = runningTag(1L, now.minusHours(2), 3600L);   // 패자
        Tag newest = runningTag(2L, now.minusMinutes(1), 10L);  // 승자(최신 시작)
        Tag middle = runningTag(3L, now.minusHours(1), 500L);   // 패자
        given(loadTagPort.findRunningTagsByMemberId(MEMBER_ID))
                .willReturn(List.of(older, newest, middle));

        service.reconcile(MEMBER_ID);

        // 승자(tag 2)는 저장 대상이 아니며 여전히 RUNNING
        assertThat(newest.isRunning()).isTrue();
        // 패자들만 정지되어 저장된다
        ArgumentCaptor<Tag> saved = ArgumentCaptor.forClass(Tag.class);
        then(saveTagPort).should(org.mockito.Mockito.times(2)).saveTag(saved.capture());
        assertThat(saved.getAllValues())
                .extracting(t -> t.getId().value())
                .containsExactlyInAnyOrder(1L, 3L);
        assertThat(saved.getAllValues()).allSatisfy(t -> {
            assertThat(t.isRunning()).isFalse();
            assertThat(t.getTimerState()).isEqualTo(TimerState.STOPPED);
        });
        // 패자의 누적 시간은 날조 없이 보존된다
        assertThat(older.getElapsedTime()).isEqualTo(3600L);
        assertThat(middle.getElapsedTime()).isEqualTo(500L);
    }
}
