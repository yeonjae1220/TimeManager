package project.TimeManager.dto;

import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Data
@NoArgsConstructor
@Getter @Setter
public class UpdateParentTagDto {
    Long newParentTagId;
}
