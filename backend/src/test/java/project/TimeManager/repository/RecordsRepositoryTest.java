package project.TimeManager.repository;

import com.querydsl.jpa.impl.JPAQueryFactory;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.entity.Records;


import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class RecordsRepositoryTest {
    @Autowired
    private RecordRepository recordRepository;
    @Autowired
    private EntityManager em;
    @Autowired
    private JPAQueryFactory jpaQueryFactory;

    // Entity 이름이 Record였는데 이는 java.lang.Record와 겹쳐서 JpaRepository가 정상 작동 하지 않음 Records로 변경
    @Test
    public void findAll() {
        List<Records> allRecord = recordRepository.findAll();
        assertThat(allRecord).hasSize(4);
    }
}