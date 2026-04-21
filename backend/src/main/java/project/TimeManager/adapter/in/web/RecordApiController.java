package project.TimeManager.adapter.in.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import project.TimeManager.adapter.in.web.dto.request.CreateRecordRequest;
import project.TimeManager.adapter.in.web.dto.request.EditRecordTimeRequest;
import project.TimeManager.adapter.in.web.dto.response.RecordResponse;
import project.TimeManager.application.dto.command.CreateRecordCommand;
import project.TimeManager.application.dto.command.EditRecordTimeCommand;
import project.TimeManager.application.dto.result.TagResult;
import project.TimeManager.domain.exception.DomainException;
import project.TimeManager.domain.port.in.record.CreateRecordUseCase;
import project.TimeManager.domain.port.in.record.DeleteRecordUseCase;
import project.TimeManager.domain.port.in.record.EditRecordTimeUseCase;
import project.TimeManager.domain.port.in.record.GetRecordListQuery;
import project.TimeManager.domain.port.in.tag.GetTagQuery;

import java.util.List;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/records")
public class RecordApiController {

    private final GetRecordListQuery getRecordListQuery;
    private final EditRecordTimeUseCase editRecordTimeUseCase;
    private final DeleteRecordUseCase deleteRecordUseCase;
    private final CreateRecordUseCase createRecordUseCase;
    private final GetTagQuery getTagQuery;

    @GetMapping
    public ResponseEntity<List<RecordResponse>> getRecordsForTag(@RequestParam Long tagId,
                                                                  @AuthenticationPrincipal Long memberId) {
        TagResult tag = getTagQuery.getTag(tagId);
        if (!tag.getMemberId().equals(memberId)) {
            throw new DomainException("접근 권한이 없습니다");
        }
        List<RecordResponse> records = getRecordListQuery.getRecordsByTagId(tagId).stream()
                .map(RecordResponse::from)
                .toList();
        return ResponseEntity.ok(records);
    }

    @PostMapping
    public ResponseEntity<Long> createRecord(@AuthenticationPrincipal Long memberId,
                                             @Valid @RequestBody CreateRecordRequest request) {
        TagResult tag = getTagQuery.getTag(request.getTagId());
        if (!tag.getMemberId().equals(memberId)) {
            throw new DomainException("접근 권한이 없습니다");
        }
        return ResponseEntity.status(201).body(createRecordUseCase.createRecord(
                new CreateRecordCommand(request.getTagId(), request.getNewStartTime(), request.getNewEndTime(), request.isForceOverwrite())
        ));
    }

    @PutMapping("/{recordId}")
    public ResponseEntity<Long> updateRecordTime(@PathVariable Long recordId,
                                                 @AuthenticationPrincipal Long memberId,
                                                 @Valid @RequestBody EditRecordTimeRequest request) {
        return ResponseEntity.ok(editRecordTimeUseCase.editRecordTime(
                new EditRecordTimeCommand(recordId, request.getNewStartTime(), request.getNewEndTime(), memberId, request.isForceOverwrite())
        ));
    }

    @DeleteMapping("/{recordId}")
    public ResponseEntity<Void> deleteRecord(@PathVariable Long recordId,
                                             @AuthenticationPrincipal Long memberId) {
        boolean deleted = deleteRecordUseCase.deleteRecord(recordId, memberId);
        return deleted ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
}
