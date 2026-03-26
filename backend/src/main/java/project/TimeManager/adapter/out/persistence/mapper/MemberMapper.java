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
                entity.getName(),
                entity.getEmail(),
                entity.getPassword(),
                entity.getProvider(),
                entity.getProviderId()
        );
    }

    public MemberJpaEntity toNewJpaEntity(Member domain) {
        MemberJpaEntity entity = new MemberJpaEntity(domain.getName());
        entity.setEmail(domain.getEmail());
        entity.setPassword(domain.getHashedPassword());
        entity.setProvider(domain.getProvider() != null ? domain.getProvider()
                : project.TimeManager.domain.member.model.OAuthProvider.LOCAL);
        entity.setProviderId(domain.getProviderId());
        return entity;
    }
}
