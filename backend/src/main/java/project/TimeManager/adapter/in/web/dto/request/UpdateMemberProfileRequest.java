package project.TimeManager.adapter.in.web.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record UpdateMemberProfileRequest(
        String name,
        String newPassword,
        String currentPassword,
        String timezone,
        @Min(0) @Max(23)
        Integer dailyResetHour
) {
}
