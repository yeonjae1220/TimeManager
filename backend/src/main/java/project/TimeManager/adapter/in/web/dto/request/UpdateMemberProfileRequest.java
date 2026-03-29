package project.TimeManager.adapter.in.web.dto.request;

public record UpdateMemberProfileRequest(
        String name,
        String newPassword,
        String currentPassword
) {
}
