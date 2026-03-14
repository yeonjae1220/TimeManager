package project.TimeManager.adapter.in.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import project.TimeManager.adapter.in.web.dto.request.CreateRecordRequest;
import project.TimeManager.adapter.in.web.dto.request.EditRecordTimeRequest;
import project.TimeManager.adapter.in.web.dto.response.RecordResponse;
import project.TimeManager.application.dto.command.CreateRecordCommand;
import project.TimeManager.application.dto.command.EditRecordTimeCommand;
import project.TimeManager.domain.port.in.record.CreateRecordUseCase;
import project.TimeManager.domain.port.in.record.DeleteRecordUseCase;
import project.TimeManager.domain.port.in.record.EditRecordTimeUseCase;
import project.TimeManager.domain.port.in.record.GetRecordListQuery;

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

    @GetMapping
    public ResponseEntity<List<RecordResponse>> getRecordsForTag(@RequestParam Long tagId) {
        List<RecordResponse> records = getRecordListQuery.getRecordsByTagId(tagId).stream()
                .map(RecordResponse::from)
                .toList();
        return ResponseEntity.ok(records);
    }

    @PostMapping
    public ResponseEntity<Long> createRecord(@Valid @RequestBody CreateRecordRequest request) {
        return ResponseEntity.status(201).body(createRecordUseCase.createRecord(
                new CreateRecordCommand(request.tagId(), request.newStartTime(), request.newEndTime())
        ));
    }

    @PutMapping("/{recordId}")
    public ResponseEntity<Long> updateRecordTime(@PathVariable Long recordId,
                                                 @Valid @RequestBody EditRecordTimeRequest request) {
        return ResponseEntity.ok(editRecordTimeUseCase.editRecordTime(
                new EditRecordTimeCommand(recordId, request.newStartTime(), request.newEndTime())
        ));
    }

    @DeleteMapping("/{recordId}")
    public ResponseEntity<Void> deleteRecord(@PathVariable Long recordId) {
        boolean deleted = deleteRecordUseCase.deleteRecord(recordId);
        return deleted ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
}
