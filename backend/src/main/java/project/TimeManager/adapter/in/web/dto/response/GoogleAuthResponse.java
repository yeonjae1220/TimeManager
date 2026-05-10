package project.TimeManager.adapter.in.web.dto.response;

public record GoogleAuthResponse(String accessToken, Long memberId, boolean newMember) {}
