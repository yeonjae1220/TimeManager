package project.TimeManager.dto;

import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.ZonedDateTime;

@Data
@NoArgsConstructor
@Getter @Setter
public class UpdateRecordTimeDto {
    ZonedDateTime newStartTime;
    ZonedDateTime newEndTime;
}
