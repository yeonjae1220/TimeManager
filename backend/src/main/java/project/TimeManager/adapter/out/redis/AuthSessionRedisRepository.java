package project.TimeManager.adapter.out.redis;

import org.springframework.data.repository.CrudRepository;

import java.util.List;

public interface AuthSessionRedisRepository extends CrudRepository<AuthSessionRedisEntity, String> {

    /** @Indexed 된 memberId 보조 인덱스로 조회한다(AuthSessionRedisEntity 주석의 한계 참조). */
    List<AuthSessionRedisEntity> findByMemberId(Long memberId);
}
