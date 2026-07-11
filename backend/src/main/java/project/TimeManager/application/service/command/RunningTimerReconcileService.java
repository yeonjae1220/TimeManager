package project.TimeManager.application.service.command;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.domain.port.in.tag.ReconcileRunningTimersUseCase;
import project.TimeManager.domain.port.out.tag.LoadTagPort;
import project.TimeManager.domain.port.out.tag.SaveTagPort;
import project.TimeManager.domain.tag.model.Tag;

import java.util.Comparator;
import java.util.List;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class RunningTimerReconcileService implements ReconcileRunningTimersUseCase {

    private final LoadTagPort loadTagPort;
    private final SaveTagPort saveTagPort;

    @Override
    public void reconcile(Long memberId) {
        List<Tag> running = loadTagPort.findRunningTagsByMemberId(memberId);
        if (running.size() <= 1) {
            return; // 정상(RUNNING 0·1개) — 쓰기 없음
        }

        // 마지막으로 시작된 태그가 승자(last-write-wins). 동시 start 레이스에서 사용자의 최신 의도를 존중한다.
        // 시작시각이 동률이면 tagId로 결정적 tie-break.
        Tag survivor = running.stream()
                .max(Comparator
                        .comparing(Tag::getLatestStartTime)
                        .thenComparing(t -> t.getId().value()))
                .orElseThrow();

        log.warn("Reconciling {} concurrently RUNNING tags for member {}; survivor tagId={}",
                running.size(), memberId, survivor.getId().value());

        for (Tag tag : running) {
            if (!tag.getId().value().equals(survivor.getId().value())) {
                tag.haltRunWithoutRecording();
                saveTagPort.saveTag(tag);
            }
        }
    }
}
