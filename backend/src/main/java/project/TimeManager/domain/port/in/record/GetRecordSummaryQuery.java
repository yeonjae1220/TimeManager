package project.TimeManager.domain.port.in.record;

import project.TimeManager.application.dto.result.RecordSummaryResult;

import java.time.LocalDate;

public interface GetRecordSummaryQuery {
    default RecordSummaryResult getSummary(Long memberId, LocalDate startDate, LocalDate endDate) {
        return getSummary(memberId, startDate, endDate, true);
    }

    RecordSummaryResult getSummary(Long memberId, LocalDate startDate, LocalDate endDate, boolean includeSessions);
}
