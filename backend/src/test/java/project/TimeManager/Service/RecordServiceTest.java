package project.TimeManager.Service;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.adapter.out.persistence.entity.RecordJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.adapter.out.persistence.repository.RecordJpaRepository;
import project.TimeManager.adapter.out.persistence.repository.TagJpaRepository;
import project.TimeManager.application.dto.command.EditRecordTimeCommand;
import project.TimeManager.application.port.in.record.DeleteRecordUseCase;
import project.TimeManager.application.port.in.record.EditRecordTimeUseCase;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class RecordServiceTest {

    @Autowired TagJpaRepository tagJpaRepository;
    @Autowired RecordJpaRepository recordJpaRepository;
    @Autowired EditRecordTimeUseCase editRecordTimeUseCase;
    @Autowired DeleteRecordUseCase deleteRecordUseCase;
    @Autowired EntityManager em;

    @Test
    @DisplayName("InitData의 ChildTag1 totalTime은 0보다 크다")
    void checkInitDataTagTotalTime() {
        TagJpaEntity childTag1 = tagJpaRepository.findAll().stream()
                .filter(t -> t.getName().equals("ChildTag1"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("ChildTag1이 존재하지 않습니다"));

        assertThat(childTag1.getTotalTime()).isGreaterThan(0L);
    }

    @Test
    @DisplayName("기록 시간 수정 시 태그의 totalTime이 차이만큼 업데이트된다")
    void updateTimeWithParentTag() {
        TagJpaEntity child1_1 = tagJpaRepository.findAll().stream()
                .filter(t -> t.getName().equals("ChildTag1_1"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("ChildTag1_1이 존재하지 않습니다"));

        List<RecordJpaEntity> records = recordJpaRepository.findByTagId(child1_1.getId());
        assertThat(records).isNotEmpty();

        RecordJpaEntity record = records.get(0);
        assertThat(record.getTotalTime()).isEqualTo(1200L);

        // 종료 시간을 13:50으로 변경 → 13:40~13:50 = 600초
        ZonedDateTime newEnd = ZonedDateTime.of(2024, 12, 5, 13, 50, 0, 0, ZoneId.of("Asia/Seoul"));
        editRecordTimeUseCase.editRecordTime(
                new EditRecordTimeCommand(record.getId(), record.getStartTime(), newEnd));

        em.flush();
        em.clear();

        TagJpaEntity child1_1After = tagJpaRepository.findById(child1_1.getId()).orElseThrow();
        assertThat(child1_1After.getTotalTime()).isEqualTo(600L);
    }

    @Test
    @DisplayName("기록 삭제 후 태그의 totalTime이 감소한다")
    void deleteRecordAdjustsTagTotalTime() {
        TagJpaEntity child1_1 = tagJpaRepository.findAll().stream()
                .filter(t -> t.getName().equals("ChildTag1_1"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("ChildTag1_1이 존재하지 않습니다"));

        long totalTimeBefore = child1_1.getTotalTime();
        List<RecordJpaEntity> records = recordJpaRepository.findByTagId(child1_1.getId());
        long recordTotalTime = records.get(0).getTotalTime();

        boolean deleted = deleteRecordUseCase.deleteRecord(records.get(0).getId());

        em.flush();
        em.clear();

        assertThat(deleted).isTrue();
        assertThat(tagJpaRepository.findById(child1_1.getId()).orElseThrow().getTotalTime())
                .isEqualTo(totalTimeBefore - recordTotalTime);
    }

    // --- 도메인 불변식이 서비스에서 전파되는지 확인 (TimeRange) ---

    @Test
    @DisplayName("[도메인 경유] editRecordTime에서 endTime이 startTime 이전이면 예외가 발생한다")
    void editRecordTimeWithEndBeforeStartThrows() {
        RecordJpaEntity anyRecord = recordJpaRepository.findAll().stream()
                .findFirst()
                .orElseThrow(() -> new AssertionError("기록이 없습니다"));

        ZonedDateTime start = ZonedDateTime.of(2024, 12, 5, 14, 0, 0, 0, ZoneId.of("Asia/Seoul"));
        ZonedDateTime end   = ZonedDateTime.of(2024, 12, 5, 13, 0, 0, 0, ZoneId.of("Asia/Seoul"));

        assertThatThrownBy(() ->
                editRecordTimeUseCase.editRecordTime(
                        new EditRecordTimeCommand(anyRecord.getId(), start, end))
        )
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("종료 시간은 시작 시간 이후여야 합니다");
    }
}
