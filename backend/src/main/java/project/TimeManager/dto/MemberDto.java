package project.TimeManager.dto;

import com.querydsl.core.annotations.QueryProjection;
import lombok.Data;
import lombok.NoArgsConstructor;
import project.TimeManager.entity.Member;

@Data
@NoArgsConstructor
public class MemberDto {
    Long id;
    private String name;

    @QueryProjection
    public MemberDto(String name) {
        this.name = name;
    }

    @QueryProjection
    public MemberDto(Member m) {
        this.id = m.getId();
        this.name = m.getName();
    }

}
