package project.TimeManager.domain.port.out.record;

import java.time.ZonedDateTime;
import java.util.List;

public interface FindOverlappingRecordsPort {

    /**
     * 지정 회원의 모든 태그에 걸쳐 [start, end) 시간대와 겹치는 레코드를 조회합니다.
     *
     * @param memberId         조회 대상 회원 ID
     * @param start            새 기록의 시작 시각
     * @param end              새 기록의 종료 시각
     * @param excludeRecordId  수정 시 자기 자신을 제외하기 위한 record ID (생성 시 null)
     */
    List<OverlapResult> findOverlappingRecords(Long memberId,
                                               ZonedDateTime start,
                                               ZonedDateTime end,
                                               Long excludeRecordId);

    record OverlapResult(Long recordId,
                         Long tagId,
                         String tagName,
                         ZonedDateTime startTime,
                         ZonedDateTime endTime) {}
}
