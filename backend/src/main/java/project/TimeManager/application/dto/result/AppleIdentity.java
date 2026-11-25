package project.TimeManager.application.dto.result;

/** 검증을 마친 Apple identity token 의 신원. email 은 사용자가 가린 경우 릴레이 주소다. */
public record AppleIdentity(String subject, String email, boolean emailVerified) {}
