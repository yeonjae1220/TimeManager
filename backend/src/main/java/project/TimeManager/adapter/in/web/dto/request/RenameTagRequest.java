package project.TimeManager.adapter.in.web.dto.request;

import jakarta.validation.constraints.NotBlank;

public record RenameTagRequest(
        @NotBlank(message = "태그 이름은 필수입니다") String name
) {}
