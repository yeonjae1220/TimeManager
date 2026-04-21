package project.TimeManager.adapter.in.web.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.ZonedDateTime;

@Getter
@Setter
@NoArgsConstructor
public class CreateRecordRequest {

    @NotNull
    private Long tagId;

    @NotNull
    private ZonedDateTime newStartTime;

    @NotNull
    private ZonedDateTime newEndTime;

    /** 중복 시간대가 있을 때 기존 기록을 삭제하고 강제 저장할지 여부 (2단계 확인 후 true로 전송) */
    private boolean forceOverwrite = false;
}
