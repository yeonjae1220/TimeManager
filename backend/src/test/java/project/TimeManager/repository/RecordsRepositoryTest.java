package project.TimeManager.repository;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.adapter.out.persistence.entity.RecordJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.adapter.out.persistence.repository.RecordJpaRepository;
import project.TimeManager.adapter.out.persistence.repository.TagJpaRepository;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class RecordsRepositoryTest {

    @Autowired RecordJpaRepository recordJpaRepository;
    @Autowired TagJpaRepository tagJpaRepository;

    @Test
    @DisplayName("전체 기록 수: InitData에서 4개 생성")
    void findAll() {
        List<RecordJpaEntity> allRecords = recordJpaRepository.findAll();
        assertThat(allRecords).hasSize(4);
    }

    @Test
    @DisplayName("findByTagId로 특정 태그의 기록만 조회된다")
    void findByTagId() {
        TagJpaEntity childTag1_1 = tagJpaRepository.findAll().stream()
                .filter(t -> t.getName().equals("ChildTag1_1"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("ChildTag1_1이 존재하지 않습니다"));

        List<RecordJpaEntity> records = recordJpaRepository.findByTagId(childTag1_1.getId());

        assertThat(records).hasSize(1);
        assertThat(records.get(0).getTotalTime()).isEqualTo(1200L); // 13:40~14:00 = 20분 = 1200초
    }
}
