package project.TimeManager.dto;

import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.ZonedDateTime;
import java.util.Map;
@Data
@NoArgsConstructor
@Getter @Setter
public class StopBtnDto {
    private Long elapsedTime;
    private Map<String, ZonedDateTime> timestamps;
}
