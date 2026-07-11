package project.TimeManager.adapter.in.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import project.TimeManager.adapter.in.web.dto.request.CreateTagRequest;
import project.TimeManager.adapter.in.web.dto.request.MoveTagRequest;
import project.TimeManager.adapter.in.web.dto.request.RenameTagRequest;
import project.TimeManager.adapter.in.web.dto.request.ReorderTagsRequest;
import project.TimeManager.adapter.in.web.dto.request.ResetTimerRequest;
import project.TimeManager.adapter.in.web.dto.request.StartTimerRequest;
import project.TimeManager.adapter.in.web.dto.request.StopTimerRequest;
import project.TimeManager.adapter.in.web.dto.response.TagResponse;
import project.TimeManager.adapter.in.web.dto.response.TagTreeResponse;
import project.TimeManager.application.dto.command.CreateTagCommand;
import project.TimeManager.application.dto.command.MoveTagCommand;
import project.TimeManager.application.dto.command.RenameTagCommand;
import project.TimeManager.application.dto.command.ReorderTagsCommand;
import project.TimeManager.application.dto.command.ResetTimerCommand;
import project.TimeManager.application.dto.command.StartTimerCommand;
import project.TimeManager.application.dto.command.StopTimerCommand;
import project.TimeManager.application.dto.result.TagResult;
import project.TimeManager.domain.exception.DomainException;
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

import java.time.ZonedDateTime;
import java.util.List;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/tags")
public class TagApiController {

    private final GetTagListQuery getTagListQuery;
    private final GetTagQuery getTagQuery;
    private final StartTimerUseCase startTimerUseCase;
    private final StopTimerUseCase stopTimerUseCase;
    private final ResetTimerUseCase resetTimerUseCase;
    private final CreateTagUseCase createTagUseCase;
    private final MoveTagUseCase moveTagUseCase;
    private final RenameTagUseCase renameTagUseCase;
    private final ReorderTagsUseCase reorderTagsUseCase;
    private final ReconcileRunningTimersUseCase reconcileRunningTimersUseCase;

    @GetMapping
    public List<TagTreeResponse> getUserTagsTree(@AuthenticationPrincipal Long memberId) {
        // 다른 기기의 동시 조작으로 서버에 다중 RUNNING이 남았다면(레이스 아티팩트) 조회 전에
        // 최신 1개로 수렴시켜, 두 기기가 서로 다른 '실행 중'을 보던 표시 불일치를 서버 권위 상태에서 치유한다.
        reconcileRunningTimersQuietly(memberId);
        return TagTreeResponse.buildTree(getTagListQuery.getTagListByMemberId(memberId));
    }

    @GetMapping("/{tagId}")
    public TagResponse getTagDetail(@PathVariable Long tagId,
                                    @AuthenticationPrincipal Long memberId) {
        reconcileRunningTimersQuietly(memberId);
        TagResult result = getTagQuery.getTag(tagId);
        if (!result.getMemberId().equals(memberId)) {
            throw new DomainException("접근 권한이 없습니다");
        }
        return TagResponse.from(result);
    }

    /**
     * 읽기 경로의 다중 RUNNING 화해는 best-effort다. 두 기기가 거의 동시에 조회하면 두 reconcile이
     * 같은 패자 행을 정지시키려다 낙관적 락(@Version)에서 한쪽이 진다 — 이는 "다른 요청이 이미 화해함"을
     * 뜻하므로 실패가 아니라 수렴 성공이다. 조회 자체를 막지 않도록 삼키고 로그만 남긴다.
     * (그 외 예외는 실제 결함일 수 있으므로 전파한다.)
     */
    private void reconcileRunningTimersQuietly(Long memberId) {
        try {
            reconcileRunningTimersUseCase.reconcile(memberId);
        } catch (ObjectOptimisticLockingFailureException e) {
            log.info("Running-timer reconcile lost an optimistic-lock race (already reconciled by a concurrent read) for member {}", memberId);
        }
    }

    @PostMapping
    public ResponseEntity<Long> createTag(@AuthenticationPrincipal Long memberId,
                                          @Valid @RequestBody CreateTagRequest request) {
        return ResponseEntity.status(201).body(createTagUseCase.createTag(
                new CreateTagCommand(request.tagName(), memberId, request.parentTagId())
        ));
    }

    @PatchMapping("/reorder")
    public ResponseEntity<Void> reorderTags(@AuthenticationPrincipal Long memberId,
                                            @Valid @RequestBody ReorderTagsRequest request) {
        reorderTagsUseCase.reorderTags(
                new ReorderTagsCommand(request.parentTagId(), request.orderedTagIds(), memberId)
        );
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{tagId}")
    public ResponseEntity<Long> moveTag(@PathVariable Long tagId,
                                        @AuthenticationPrincipal Long memberId,
                                        @Valid @RequestBody MoveTagRequest request) {
        return ResponseEntity.ok(moveTagUseCase.moveTag(
                new MoveTagCommand(tagId, request.newParentTagId(), memberId)
        ));
    }

    @PatchMapping("/{tagId}/name")
    public ResponseEntity<Long> renameTag(@PathVariable Long tagId,
                                          @AuthenticationPrincipal Long memberId,
                                          @Valid @RequestBody RenameTagRequest request) {
        return ResponseEntity.ok(renameTagUseCase.renameTag(
                new RenameTagCommand(tagId, request.name(), memberId)
        ));
    }

    @PostMapping("/{tagId}/timer/start")
    public ResponseEntity<Long> startTimer(@PathVariable Long tagId,
                                           @AuthenticationPrincipal Long memberId,
                                           @Valid @RequestBody StartTimerRequest request) {
        return ResponseEntity.ok(startTimerUseCase.startTimer(new StartTimerCommand(tagId, request.startTime(), memberId)));
    }

    @PostMapping("/{tagId}/timer/stop")
    public ResponseEntity<Long> stopTimer(@PathVariable Long tagId,
                                          @AuthenticationPrincipal Long memberId,
                                          @Valid @RequestBody StopTimerRequest request) {
        ZonedDateTime startTime = request.timestamps().startTime();
        ZonedDateTime endTime = request.timestamps().endTime();
        log.info("Stop timer: tagId={}, startTime={}, endTime={}", tagId, startTime, endTime);
        return ResponseEntity.ok(stopTimerUseCase.stopTimer(
                new StopTimerCommand(tagId, request.elapsedTime(), startTime, endTime, memberId)
        ));
    }

    @PostMapping("/{tagId}/timer/reset")
    public ResponseEntity<Long> resetTimer(@PathVariable Long tagId,
                                           @AuthenticationPrincipal Long memberId,
                                           @Valid @RequestBody ResetTimerRequest request) {
        return ResponseEntity.ok(resetTimerUseCase.resetTimer(
                new ResetTimerCommand(tagId, request.elapsedTime(), memberId)
        ));
    }
}
