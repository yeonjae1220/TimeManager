package project.TimeManager.adapter.out.redis;

import org.springframework.data.repository.CrudRepository;

public interface AuthSessionRedisRepository extends CrudRepository<AuthSessionRedisEntity, String> {
}
