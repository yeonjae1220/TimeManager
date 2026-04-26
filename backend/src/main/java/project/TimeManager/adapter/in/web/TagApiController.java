package project.TimeManager.adapter.in.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import project.TimeManager.adapter.in.web.dto.request.CreateTagRequest;
import project.TimeManager.adapter.in.web.dto.request.MoveTagRequest;
import project.TimeManager.adapter.in.web.dto.request.ReorderTagsRequest;
import project.TimeManager.adapter.in.web.dto.request.ResetTimerRequest;
import project.TimeManager.adapter.in.web.dto.request.StartTimerRequest;
import project.TimeManager.adapter.in.web.dto.request.StopTimerRequest;
import project.TimeManager.adapter.in.web.dto.response.TagResponse;
import project.TimeManager.adapter.in.web.dto.response.TagTreeResponse;
import project.TimeManager.application.dto.command.CreateTagCommand;
import project.TimeManager.application.dto.command.MoveTagCommand;
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
    private final ReorderTagsUseCase reorderTagsUseCase;

    @GetMapping
    public List<TagTreeResponse> getUserTagsTree(@AuthenticationPrincipal Long memberId) {
        return TagTreeResponse.buildTree(getTagListQuery.getTagListByMemberId(memberId));
    }

    @GetMapping("/{tagId}")
    public TagResponse getTagDetail(@PathVariable Long tagId,
                                    @AuthenticationPrincipal Long memberId) {
        TagResult result = getTagQuery.getTag(tagId);
        if (!result.getMemberId().equals(memberId)) {
            throw new DomainException("접근 권한이 없습니다");
        }
        return TagResponse.from(result);
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

    @PostMapping("/{tagId}/timer/start")
    public ResponseEntity<Long> startTimer(@PathVariable Long tagId,
                                           @Valid @RequestBody StartTimerRequest request) {
        return ResponseEntity.ok(startTimerUseCase.startTimer(new StartTimerCommand(tagId, request.startTime())));
    }

    @PostMapping("/{tagId}/timer/stop")
    public ResponseEntity<Long> stopTimer(@PathVariable Long tagId,
                                          @Valid @RequestBody StopTimerRequest request) {
        ZonedDateTime startTime = request.timestamps().startTime();
        ZonedDateTime endTime = request.timestamps().endTime();
        log.info("Stop timer: tagId={}, startTime={}, endTime={}", tagId, startTime, endTime);
        return ResponseEntity.ok(stopTimerUseCase.stopTimer(
                new StopTimerCommand(tagId, request.elapsedTime(), startTime, endTime)
        ));
    }

    @PostMapping("/{tagId}/timer/reset")
    public ResponseEntity<Long> resetTimer(@PathVariable Long tagId,
                                           @Valid @RequestBody ResetTimerRequest request) {
        return ResponseEntity.ok(resetTimerUseCase.resetTimer(
                new ResetTimerCommand(tagId, request.elapsedTime())
        ));
    }
}
