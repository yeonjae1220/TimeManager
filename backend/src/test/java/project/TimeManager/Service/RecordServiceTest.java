package project.TimeManager.Service;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.adapter.out.persistence.entity.RecordJpaEntity;
import project.TimeManager.adapter.out.persistence.entity.TagJpaEntity;
import project.TimeManager.adapter.out.persistence.repository.RecordJpaRepository;
import project.TimeManager.adapter.out.persistence.repository.TagJpaRepository;
import project.TimeManager.application.dto.command.EditRecordTimeCommand;
import project.TimeManager.application.service.notification.PushSender;
import project.TimeManager.domain.port.in.record.DeleteRecordUseCase;
import project.TimeManager.domain.port.in.record.EditRecordTimeUseCase;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class RecordServiceTest {

    @MockBean PushSender pushSender;
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
        long originalTotal = record.getTotalTime();

        // 종료 시간을 30분 단축
        ZonedDateTime newEnd = record.getStartTime().plusMinutes(30);
        editRecordTimeUseCase.editRecordTime(
                new EditRecordTimeCommand(record.getId(), record.getStartTime(), newEnd,
                        child1_1.getMember().getId(), false));

        em.flush();
        em.clear();

        TagJpaEntity child1_1After = tagJpaRepository.findById(child1_1.getId()).orElseThrow();
        List<RecordJpaEntity> updatedRecords = recordJpaRepository.findByTagId(child1_1.getId());
        long expectedDelta = 1800L - originalTotal; // 1800초로 변경
        assertThat(child1_1After.getTotalTime()).isEqualTo(child1_1.getTotalTime() + expectedDelta);
        assertThat(child1_1After.getTagTotalTime()).isEqualTo(
                updatedRecords.stream().mapToLong(RecordJpaEntity::getTotalTime).sum()
        );
        ZonedDateTime latestStopTime = updatedRecords.stream()
                .map(RecordJpaEntity::getEndTime)
                .max(ZonedDateTime::compareTo)
                .orElse(child1_1After.getLatestStopTime());
        assertThat(child1_1After.getLatestStopTime()).isEqualTo(latestStopTime);
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
        assertThat(records).isNotEmpty();
        long recordTotalTime = records.get(0).getTotalTime();

        boolean deleted = deleteRecordUseCase.deleteRecord(records.get(0).getId(), child1_1.getMember().getId());

        em.flush();
        em.clear();

        assertThat(deleted).isTrue();
        TagJpaEntity updatedTag = tagJpaRepository.findById(child1_1.getId()).orElseThrow();
        assertThat(updatedTag.getTotalTime()).isEqualTo(totalTimeBefore - recordTotalTime);
        long remainingTagTotal = recordJpaRepository.findByTagId(child1_1.getId()).stream()
                .mapToLong(RecordJpaEntity::getTotalTime)
                .sum();
        assertThat(updatedTag.getTagTotalTime()).isEqualTo(remainingTagTotal);
        ZonedDateTime latestRemainingStop = recordJpaRepository.findByTagId(child1_1.getId()).stream()
                .map(RecordJpaEntity::getEndTime)
                .max(ZonedDateTime::compareTo)
                .orElse(updatedTag.getLatestStopTime());
        assertThat(updatedTag.getLatestStopTime()).isEqualTo(latestRemainingStop);
    }

    @Test
    @DisplayName("[도메인 경유] editRecordTime에서 endTime이 startTime 이전이면 예외가 발생한다")
    void editRecordTimeWithEndBeforeStartThrows() {
        RecordJpaEntity anyRecord = recordJpaRepository.findAll().stream()
                .findFirst()
                .orElseThrow(() -> new AssertionError("기록이 없습니다"));

        ZonedDateTime start = ZonedDateTime.of(2024, 12, 5, 14, 0, 0, 0, ZoneId.of("Asia/Seoul"));
        ZonedDateTime end   = ZonedDateTime.of(2024, 12, 5, 13, 0, 0, 0, ZoneId.of("Asia/Seoul"));

        Long memberId = anyRecord.getTag().getMember().getId();
        assertThatThrownBy(() ->
                editRecordTimeUseCase.editRecordTime(
                        new EditRecordTimeCommand(anyRecord.getId(), start, end, memberId, false))
        )
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("종료 시간은 시작 시간 이후여야 합니다");
    }
}
