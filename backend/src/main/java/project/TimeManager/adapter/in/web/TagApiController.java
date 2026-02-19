package project.TimeManager.adapter.in.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import project.TimeManager.adapter.in.web.dto.request.CreateTagRequest;
import project.TimeManager.adapter.in.web.dto.request.MoveTagRequest;
import project.TimeManager.adapter.in.web.dto.request.ResetTimerRequest;
import project.TimeManager.adapter.in.web.dto.request.StopTimerRequest;
import project.TimeManager.adapter.in.web.dto.response.TagResponse;
import project.TimeManager.adapter.in.web.dto.response.TagTreeResponse;
import project.TimeManager.application.dto.command.CreateTagCommand;
import project.TimeManager.application.dto.command.MoveTagCommand;
import project.TimeManager.application.dto.command.ResetTimerCommand;
import project.TimeManager.application.dto.command.StartTimerCommand;
import project.TimeManager.application.dto.command.StopTimerCommand;
import project.TimeManager.application.port.in.tag.*;

import java.time.ZonedDateTime;
import java.util.List;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/tag")
public class TagApiController {

    private final GetTagListQuery getTagListQuery;
    private final GetTagQuery getTagQuery;
    private final StartTimerUseCase startTimerUseCase;
    private final StopTimerUseCase stopTimerUseCase;
    private final ResetTimerUseCase resetTimerUseCase;
    private final CreateTagUseCase createTagUseCase;
    private final MoveTagUseCase moveTagUseCase;

    @GetMapping("/{memberId}")
    public List<TagTreeResponse> getUserTagsTree(@PathVariable Long memberId) {
        return TagTreeResponse.buildTree(getTagListQuery.getTagListByMemberId(memberId));
    }

    @GetMapping("/detail/{tagId}")
    public TagResponse getTagDetail(@PathVariable Long tagId) {
        return TagResponse.from(getTagQuery.getTag(tagId));
    }

    @PostMapping("/{tagId}/start")
    public ResponseEntity<Long> startStopwatch(@PathVariable Long tagId, @RequestBody ZonedDateTime startTime) {
        return ResponseEntity.ok(startTimerUseCase.startTimer(new StartTimerCommand(tagId, startTime)));
    }

    @PostMapping("/{tagId}/reset")
    public ResponseEntity<Long> resetStopwatch(@PathVariable Long tagId,
                                                @Valid @RequestBody ResetTimerRequest request) {
        return ResponseEntity.ok(resetTimerUseCase.resetTimer(
                new ResetTimerCommand(tagId, request.elapsedTime())
        ));
    }

    @PostMapping("/{tagId}/create")
    public ResponseEntity<Long> createTag(@PathVariable Long tagId,
                                           @Valid @RequestBody CreateTagRequest request) {
        return ResponseEntity.ok(createTagUseCase.createTag(
                new CreateTagCommand(request.tagName(), request.memberId(), request.parentTagId())
        ));
    }

    @PutMapping("/{tagId}/updateParent")
    public ResponseEntity<Long> moveTag(@PathVariable Long tagId,
                                         @Valid @RequestBody MoveTagRequest request) {
        return ResponseEntity.ok(moveTagUseCase.moveTag(
                new MoveTagCommand(tagId, request.newParentTagId())
        ));
    }
}
