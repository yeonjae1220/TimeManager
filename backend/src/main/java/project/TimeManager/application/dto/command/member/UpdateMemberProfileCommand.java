package project.TimeManager.application.dto.command.member;

public record UpdateMemberProfileCommand(
        Long memberId,
        String newName,
        String newPassword,
        String currentPassword
) {
}
