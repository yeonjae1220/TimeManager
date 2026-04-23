package project.TimeManager.domain.port.in.record;

import project.TimeManager.application.dto.result.RecordSummaryResult;

import java.time.LocalDate;

public interface GetRecordSummaryQuery {
    RecordSummaryResult getSummary(Long memberId, LocalDate startDate, LocalDate endDate);
}
