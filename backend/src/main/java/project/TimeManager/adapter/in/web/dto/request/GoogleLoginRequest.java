package project.TimeManager.adapter.in.web.dto.request;

import jakarta.validation.constraints.NotBlank;

public record GoogleLoginRequest(
        @NotBlank String code,
        @NotBlank String redirectUri
) {}
