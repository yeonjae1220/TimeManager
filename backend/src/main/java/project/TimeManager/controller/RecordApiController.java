package project.TimeManager.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import project.TimeManager.Service.RecordService;
import project.TimeManager.dto.RecordDto;
import project.TimeManager.dto.StopBtnDto;
import project.TimeManager.dto.UpdateRecordTimeDto;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/record")
public class RecordApiController {
    private final RecordService recordService;

    // 스톱워치 종료 (Vue에서 시작 시간과 종료 시간을 함께 전달)
    @PostMapping("/{tagId}/stop")
    public ResponseEntity<Long> stopStopwatch(@PathVariable Long tagId, @RequestBody StopBtnDto stopBtnDto) {
        ZonedDateTime startTime = stopBtnDto.getTimestamps().get("startTime");
        ZonedDateTime endTime = stopBtnDto.getTimestamps().get("endTime");
        Long elapsedTime = stopBtnDto.getElapsedTime();

        log.info("ApiControllerStartTime : " + startTime + "ApiControllerStopTime : " + endTime);

        return ResponseEntity.ok(recordService.stopStopwatch(tagId, elapsedTime, startTime, endTime));
    }

    @GetMapping("/log/{tagId}")
    public ResponseEntity<List<RecordDto>> AllRecordInOneTag(@PathVariable Long tagId) {
        List<RecordDto> records = recordService.findAllRecordDtoByTagId(tagId);
        return ResponseEntity.ok(records);
    }

    @PutMapping("/updateTime/{recordId}")
    public ResponseEntity<Long> updateRecordTime(@PathVariable Long recordId, @RequestBody UpdateRecordTimeDto updateRecordTimeDto) {
        ZonedDateTime newStartTime = updateRecordTimeDto.getNewStartTime();
        ZonedDateTime newEndTime = updateRecordTimeDto.getNewEndTime();

        return ResponseEntity.ok(recordService.editTime(recordId, newStartTime, newEndTime));
    }

    @DeleteMapping("/delete/{recordId}")
    public ResponseEntity<String> deleteRecord(@PathVariable Long recordId) {
        boolean deleted = recordService.deleteRecord(recordId);

        if (deleted) {
            return ResponseEntity.ok("Record deleted successfully.");
        } else {
            return ResponseEntity.badRequest().body("Record not found.");
        }
    }

    @PostMapping("/create/{tagId}")
    public ResponseEntity<String> createRecord(@PathVariable Long tagId, @RequestBody UpdateRecordTimeDto recordTimeDto) {
        ZonedDateTime startTime = recordTimeDto.getNewStartTime();
        ZonedDateTime endTime = recordTimeDto.getNewEndTime();
        Long recordId = recordService.createRecordWithId(tagId, startTime, endTime);
        return ResponseEntity.ok("Record create successfully.");
    }
}
