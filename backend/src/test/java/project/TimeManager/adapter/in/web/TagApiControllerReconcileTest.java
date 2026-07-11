package project.TimeManager.adapter.in.web;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import project.TimeManager.domain.port.in.tag.CreateTagUseCase;
import project.TimeManager.domain.port.in.tag.GetTagListQuery;
import project.TimeManager.domain.port.in.tag.GetTagQuery;
import project.TimeManager.domain.port.in.tag.MoveTagUseCase;
import project.TimeManager.domain.port.in.tag.ReconcileRunningTimersUseCase;
import project.TimeManager.domain.port.in.tag.RenameTagUseCase;
import project.TimeManager.domain.port.in.tag.ReorderTagsUseCase;
import project.TimeManager.domain.port.in.tag.ResetTimerUseCase;
import project.TimeManager.domain.port.in.tag.StartTimerUseCase;
import project.TimeManager.domain.port.in.tag.StopTimerUseCase;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.mock;

@ExtendWith(MockitoExtension.class)
@DisplayName("TagApiController — 읽기 경로 화해 방어")
class TagApiControllerReconcileTest {

    @Mock GetTagListQuery getTagListQuery;
    @Mock GetTagQuery getTagQuery;
    @Mock ReconcileRunningTimersUseCase reconcileRunningTimersUseCase;

    private TagApiController controller;

    @BeforeEach
    void setUp() {
        controller = new TagApiController(
                getTagListQuery,
                getTagQuery,
                mock(StartTimerUseCase.class),
                mock(StopTimerUseCase.class),
                mock(ResetTimerUseCase.class),
                mock(CreateTagUseCase.class),
                mock(MoveTagUseCase.class),
                mock(RenameTagUseCase.class),
                mock(ReorderTagsUseCase.class),
                reconcileRunningTimersUseCase
        );
    }

    @Test
    @DisplayName("동시 조회로 화해가 낙관적 락에서 지더라도(ObjectOptimisticLockingFailureException) 목록 조회는 정상 반환된다")
    void concurrentReconcileOptimisticFailure_stillServesList() {
        // 다른 요청이 이미 화해를 커밋해 이 요청의 화해가 낙관적 락에서 진 상황
        willThrow(new ObjectOptimisticLockingFailureException("tag", 1L))
                .given(reconcileRunningTimersUseCase).reconcile(7L);
        given(getTagListQuery.getTagListByMemberId(7L)).willReturn(List.of());

        // 화해 실패가 GET을 500으로 만들지 않고, 조회 결과를 그대로 반환해야 한다
        assertThatCode(() -> controller.getUserTagsTree(7L)).doesNotThrowAnyException();
    }
}
