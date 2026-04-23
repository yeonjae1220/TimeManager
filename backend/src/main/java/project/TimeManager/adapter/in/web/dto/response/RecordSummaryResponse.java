package project.TimeManager.adapter.in.web.dto.response;

import project.TimeManager.application.dto.result.RecordSummaryResult;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.stream.Collectors;

public class RecordSummaryResponse {

    private final Long totalSeconds;
    private final List<TagSummaryResponse> tagSummaries;

    private RecordSummaryResponse(Long totalSeconds, List<TagSummaryResponse> tagSummaries) {
        this.totalSeconds = totalSeconds;
        this.tagSummaries = tagSummaries;
    }

    public static RecordSummaryResponse from(RecordSummaryResult result) {
        List<TagSummaryResponse> tags = result.getTagSummaries().stream()
                .map(TagSummaryResponse::from)
                .collect(Collectors.toList());
        return new RecordSummaryResponse(result.getTotalSeconds(), tags);
    }

    public Long getTotalSeconds() { return totalSeconds; }
    public List<TagSummaryResponse> getTagSummaries() { return tagSummaries; }

    public static class TagSummaryResponse {
        private final Long tagId;
        private final String tagName;
        private final String parentTagName;
        private final Long totalSeconds;
        private final int sessionCount;
        private final List<SessionDetailResponse> sessions;

        private TagSummaryResponse(Long tagId, String tagName, String parentTagName,
                                   Long totalSeconds, int sessionCount, List<SessionDetailResponse> sessions) {
            this.tagId = tagId;
            this.tagName = tagName;
            this.parentTagName = parentTagName;
            this.totalSeconds = totalSeconds;
            this.sessionCount = sessionCount;
            this.sessions = sessions;
        }

        public static TagSummaryResponse from(RecordSummaryResult.TagSummary summary) {
            List<SessionDetailResponse> sessions = summary.getSessions().stream()
                    .map(SessionDetailResponse::from)
                    .collect(Collectors.toList());
            return new TagSummaryResponse(
                    summary.getTagId(), summary.getTagName(), summary.getParentTagName(),
                    summary.getTotalSeconds(), summary.getSessionCount(), sessions);
        }

        public Long getTagId() { return tagId; }
        public String getTagName() { return tagName; }
        public String getParentTagName() { return parentTagName; }
        public Long getTotalSeconds() { return totalSeconds; }
        public int getSessionCount() { return sessionCount; }
        public List<SessionDetailResponse> getSessions() { return sessions; }
    }

    public static class SessionDetailResponse {
        private final ZonedDateTime startTime;
        private final ZonedDateTime endTime;
        private final Long durationSeconds;

        private SessionDetailResponse(ZonedDateTime startTime, ZonedDateTime endTime, Long durationSeconds) {
            this.startTime = startTime;
            this.endTime = endTime;
            this.durationSeconds = durationSeconds;
        }

        public static SessionDetailResponse from(RecordSummaryResult.SessionDetail detail) {
            return new SessionDetailResponse(detail.getStartTime(), detail.getEndTime(), detail.getDurationSeconds());
        }

        public ZonedDateTime getStartTime() { return startTime; }
        public ZonedDateTime getEndTime() { return endTime; }
        public Long getDurationSeconds() { return durationSeconds; }
    }
}
