package project.TimeManager.adapter.in.web.dto.request;

import jakarta.validation.constraints.NotNull;

public record MoveTagRequest(
        @NotNull(message = "newParentTagId는 필수입니다") Long newParentTagId
) {}
