package project.TimeManager.adapter.out.persistence.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import project.TimeManager.adapter.out.persistence.entity.RecordJpaEntity;

public interface RecordJpaRepository extends JpaRepository<RecordJpaEntity, Long>, RecordJpaRepositoryCustom {
}
