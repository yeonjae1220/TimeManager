package project.TimeManager.dto;

import com.querydsl.core.annotations.QueryProjection;
import lombok.Data;
import lombok.NoArgsConstructor;
import project.TimeManager.entity.Records;

import java.time.ZonedDateTime;

@Data
@NoArgsConstructor
public class RecordDto {
    private Long id;
    private ZonedDateTime startTime;
    private ZonedDateTime endTime;
    private Long totalTime;

    @QueryProjection
    public RecordDto(Records r) {
        this.id = r.getId();
        this.startTime = r.getStartTime();
        this.endTime = r.getEndTime();
        this.totalTime = r.getTotalTime();
    }
}
