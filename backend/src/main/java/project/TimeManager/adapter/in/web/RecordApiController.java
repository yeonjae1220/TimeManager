package project.TimeManager.adapter.in.web;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import project.TimeManager.adapter.in.web.dto.request.EditRecordTimeRequest;
import project.TimeManager.adapter.in.web.dto.request.StopTimerRequest;
import project.TimeManager.adapter.in.web.dto.response.RecordResponse;
import project.TimeManager.application.dto.command.CreateRecordCommand;
import project.TimeManager.application.dto.command.EditRecordTimeCommand;
import project.TimeManager.application.dto.command.StopTimerCommand;
import project.TimeManager.application.port.in.record.CreateRecordUseCase;
import project.TimeManager.application.port.in.record.DeleteRecordUseCase;
import project.TimeManager.application.port.in.record.EditRecordTimeUseCase;
import project.TimeManager.application.port.in.record.GetRecordListQuery;
import project.TimeManager.application.port.in.tag.StopTimerUseCase;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/record")
public class RecordApiController {

    private final StopTimerUseCase stopTimerUseCase;
    private final GetRecordListQuery getRecordListQuery;
    private final EditRecordTimeUseCase editRecordTimeUseCase;
    private final DeleteRecordUseCase deleteRecordUseCase;
    private final CreateRecordUseCase createRecordUseCase;

    @PostMapping("/{tagId}/stop")
    public ResponseEntity<Long> stopStopwatch(@PathVariable Long tagId,
                                               @Valid @RequestBody StopTimerRequest request) {
        ZonedDateTime startTime = request.timestamps().get("startTime");
        ZonedDateTime endTime = request.timestamps().get("endTime");
        log.info("Stop timer: tagId={}, startTime={}, endTime={}", tagId, startTime, endTime);
        return ResponseEntity.ok(stopTimerUseCase.stopTimer(
                new StopTimerCommand(tagId, request.elapsedTime(), startTime, endTime)
        ));
    }

    @GetMapping("/log/{tagId}")
    public ResponseEntity<List<RecordResponse>> getRecordsForTag(@PathVariable Long tagId) {
        List<RecordResponse> records = getRecordListQuery.getRecordsByTagId(tagId).stream()
                .map(RecordResponse::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(records);
    }

    @PutMapping("/updateTime/{recordId}")
    public ResponseEntity<Long> updateRecordTime(@PathVariable Long recordId,
                                                  @Valid @RequestBody EditRecordTimeRequest request) {
        return ResponseEntity.ok(editRecordTimeUseCase.editRecordTime(
                new EditRecordTimeCommand(recordId, request.newStartTime(), request.newEndTime())
        ));
    }

    @DeleteMapping("/delete/{recordId}")
    public ResponseEntity<String> deleteRecord(@PathVariable Long recordId) {
        boolean deleted = deleteRecordUseCase.deleteRecord(recordId);
        return deleted
                ? ResponseEntity.ok("Record deleted successfully.")
                : ResponseEntity.badRequest().body("Record not found.");
    }

    @PostMapping("/create/{tagId}")
    public ResponseEntity<String> createRecord(@PathVariable Long tagId,
                                                @Valid @RequestBody EditRecordTimeRequest request) {
        createRecordUseCase.createRecord(
                new CreateRecordCommand(tagId, request.newStartTime(), request.newEndTime())
        );
        return ResponseEntity.ok("Record created successfully.");
    }
}
