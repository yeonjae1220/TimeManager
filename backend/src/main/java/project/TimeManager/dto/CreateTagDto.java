package project.TimeManager.dto;

import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import project.TimeManager.entity.Tag;

import java.time.ZonedDateTime;
import java.util.Map;

@Data
@NoArgsConstructor
@Getter  @Setter
public class CreateTagDto {
    private String tagName;
    private Long memberId;
    private Long parentTagId;
}
