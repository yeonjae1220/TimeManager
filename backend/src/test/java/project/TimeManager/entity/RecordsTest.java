package project.TimeManager.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import project.TimeManager.adapter.out.persistence.repository.RecordJpaRepository;
import project.TimeManager.adapter.out.persistence.repository.TagJpaRepository;
import project.TimeManager.application.dto.command.CreateRecordCommand;
import project.TimeManager.application.dto.command.CreateTagCommand;
import project.TimeManager.application.port.in.member.CreateMemberUseCase;
import project.TimeManager.application.port.in.record.CreateRecordUseCase;
import project.TimeManager.application.port.in.tag.CreateTagUseCase;
import project.TimeManager.domain.record.model.TimeRange;
import project.TimeManager.domain.tag.model.TagType;

import java.time.ZoneId;
import java.time.ZonedDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class RecordsTest {

    @Autowired RecordJpaRepository recordJpaRepository;
    @Autowired TagJpaRepository tagJpaRepository;
    @Autowired CreateMemberUseCase createMemberUseCase;
    @Autowired CreateTagUseCase createTagUseCase;
    @Autowired CreateRecordUseCase createRecordUseCase;

    @Test
    @DisplayName("InitData로 생성된 모든 기록은 totalTime이 0보다 크다")
    void checkTotalTime() {
        recordJpaRepository.findAll().forEach(r ->
                assertThat(r.getTotalTime()).isGreaterThan(0L));
    }

    @Test
    @DisplayName("기록 생성 시 시작-종료 시간 차이가 totalTime으로 저장된다")
    void createRecordCalculatesTotalTimeCorrectly() {
        Long memberId = createMemberUseCase.createMember("recordTestMember");
        Long rootId = tagJpaRepository.findByMemberId(memberId).stream()
                .filter(t -> t.getType() == TagType.ROOT).findFirst().orElseThrow().getId();
        Long tagId = createTagUseCase.createTag(new CreateTagCommand("testTag", memberId, rootId));

        ZonedDateTime start = ZonedDateTime.of(2024, 1, 1, 10, 0, 0, 0, ZoneId.of("Asia/Seoul"));
        ZonedDateTime end   = ZonedDateTime.of(2024, 1, 1, 11, 0, 0, 0, ZoneId.of("Asia/Seoul"));

        Long recordId = createRecordUseCase.createRecord(new CreateRecordCommand(tagId, start, end));

        assertThat(recordJpaRepository.findById(recordId).orElseThrow().getTotalTime())
                .isEqualTo(3600L);
    }

    // --- 도메인 불변식 테스트 (TimeRange value object) ---

    @Test
    @DisplayName("[도메인] TimeRange: endTime이 startTime 이전이면 예외가 발생한다")
    void timeRangeEndBeforeStartThrows() {
        ZonedDateTime start = ZonedDateTime.of(2024, 1, 1, 11, 0, 0, 0, ZoneId.of("Asia/Seoul"));
        ZonedDateTime end   = ZonedDateTime.of(2024, 1, 1, 10, 0, 0, 0, ZoneId.of("Asia/Seoul"));

        assertThatThrownBy(() -> new TimeRange(start, end))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("종료 시간은 시작 시간 이후여야 합니다");
    }

    @Test
    @DisplayName("[도메인] TimeRange: start가 null이면 예외가 발생한다")
    void timeRangeNullStartThrows() {
        ZonedDateTime end = ZonedDateTime.of(2024, 1, 1, 11, 0, 0, 0, ZoneId.of("Asia/Seoul"));

        assertThatThrownBy(() -> new TimeRange(null, end))
                .isInstanceOf(NullPointerException.class)
                .hasMessageContaining("시작 시간은 필수입니다");
    }

    @Test
    @DisplayName("[도메인] TimeRange: durationInSeconds가 정확히 계산된다")
    void timeRangeDurationCalculation() {
        ZonedDateTime start = ZonedDateTime.of(2024, 1, 1, 10, 0, 0, 0, ZoneId.of("Asia/Seoul"));
        ZonedDateTime end   = ZonedDateTime.of(2024, 1, 1, 11, 30, 0, 0, ZoneId.of("Asia/Seoul"));

        assertThat(new TimeRange(start, end).durationInSeconds()).isEqualTo(5400L);
    }
}
