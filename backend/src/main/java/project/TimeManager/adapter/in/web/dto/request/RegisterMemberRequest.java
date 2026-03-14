package project.TimeManager.adapter.in.web.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record RegisterMemberRequest(
        @NotBlank String name,
        @NotBlank @Email String email,
        @NotBlank String password
) {}
