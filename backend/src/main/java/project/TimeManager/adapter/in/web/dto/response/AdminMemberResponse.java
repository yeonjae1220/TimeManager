package project.TimeManager.adapter.in.web.dto.response;

import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.member.model.MemberRole;
import project.TimeManager.domain.member.model.OAuthProvider;

public record AdminMemberResponse(
        Long id,
        String name,
        String email,
        OAuthProvider provider,
        MemberRole role
) {
    public static AdminMemberResponse from(Member member) {
        return new AdminMemberResponse(
                member.getId().value(),
                member.getName(),
                member.getEmail(),
                member.getProvider(),
                member.getRole()
        );
    }
}
