package project.TimeManager.adapter.in.web.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record ReorderTagsRequest(
        @NotNull(message = "parentTagId는 필수입니다") Long parentTagId,
        @NotEmpty(message = "orderedTagIds는 비어있을 수 없습니다") List<Long> orderedTagIds
) {}
