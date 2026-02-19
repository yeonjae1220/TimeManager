package project.TimeManager.adapter.in.web.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateTagRequest(
        @NotBlank(message = "태그 이름은 필수입니다") String tagName,
        @NotNull(message = "memberId는 필수입니다") Long memberId,
        @NotNull(message = "parentTagId는 필수입니다") Long parentTagId
) {}
