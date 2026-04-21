package project.TimeManager.adapter.in.web.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.ZonedDateTime;

@Getter
@Setter
@NoArgsConstructor
public class EditRecordTimeRequest {

    @NotNull(message = "시작 시간은 필수입니다")
    private ZonedDateTime newStartTime;

    @NotNull(message = "종료 시간은 필수입니다")
    private ZonedDateTime newEndTime;

    /** 중복 시간대가 있을 때 기존 기록을 삭제하고 강제 저장할지 여부 (2단계 확인 후 true로 전송) */
    private boolean forceOverwrite = false;
}
