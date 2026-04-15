package project.TimeManager.adapter.in.web.dto.request;

import jakarta.validation.constraints.NotNull;
import project.TimeManager.domain.member.model.MemberRole;

public record UpdateMemberRoleRequest(
        @NotNull(message = "Role cannot be null") MemberRole role) {
}
