package project.TimeManager.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import project.TimeManager.entity.Records;

public interface RecordRepository extends JpaRepository<Records, Long>, RecordRepositoryCustom {
}
