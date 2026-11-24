package project.TimeManager.adapter.in.web.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PushUnsubscribeRequest(@NotBlank @Size(max = 512) String endpoint) {}
