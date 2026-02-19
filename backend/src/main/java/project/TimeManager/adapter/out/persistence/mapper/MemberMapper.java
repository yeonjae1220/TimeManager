package project.TimeManager.adapter.out.persistence.mapper;

import org.springframework.stereotype.Component;
import project.TimeManager.adapter.out.persistence.entity.MemberJpaEntity;
import project.TimeManager.domain.member.model.Member;
import project.TimeManager.domain.member.model.MemberId;

@Component
public class MemberMapper {

    public Member toDomain(MemberJpaEntity entity) {
        return Member.reconstitute(
                MemberId.of(entity.getId()),
                entity.getName()
        );
    }

    public MemberJpaEntity toNewJpaEntity(Member domain) {
        MemberJpaEntity entity = new MemberJpaEntity(domain.getName());
        return entity;
    }
}
