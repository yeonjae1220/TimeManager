package project.TimeManager.application.dto.command;

public record SavePushSubscriptionCommand(
        Long memberId,
        String endpoint,
        String p256dh,
        String auth
) {}
