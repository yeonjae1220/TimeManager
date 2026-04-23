package project.TimeManager.application.dto.result;

import java.time.ZonedDateTime;
import java.util.List;

public class RecordSummaryResult {

    private final Long totalSeconds;
    private final List<TagSummary> tagSummaries;

    public RecordSummaryResult(Long totalSeconds, List<TagSummary> tagSummaries) {
        this.totalSeconds = totalSeconds;
        this.tagSummaries = tagSummaries;
    }

    public Long getTotalSeconds() { return totalSeconds; }
    public List<TagSummary> getTagSummaries() { return tagSummaries; }

    public static class TagSummary {
        private final Long tagId;
        private final String tagName;
        private final String parentTagName;
        private final Long totalSeconds;
        private final int sessionCount;
        private final List<SessionDetail> sessions;

        public TagSummary(Long tagId, String tagName, String parentTagName,
                          Long totalSeconds, int sessionCount, List<SessionDetail> sessions) {
            this.tagId = tagId;
            this.tagName = tagName;
            this.parentTagName = parentTagName;
            this.totalSeconds = totalSeconds;
            this.sessionCount = sessionCount;
            this.sessions = sessions;
        }

        public Long getTagId() { return tagId; }
        public String getTagName() { return tagName; }
        public String getParentTagName() { return parentTagName; }
        public Long getTotalSeconds() { return totalSeconds; }
        public int getSessionCount() { return sessionCount; }
        public List<SessionDetail> getSessions() { return sessions; }
    }

    public static class SessionDetail {
        private final ZonedDateTime startTime;
        private final ZonedDateTime endTime;
        private final Long durationSeconds;

        public SessionDetail(ZonedDateTime startTime, ZonedDateTime endTime, Long durationSeconds) {
            this.startTime = startTime;
            this.endTime = endTime;
            this.durationSeconds = durationSeconds;
        }

        public ZonedDateTime getStartTime() { return startTime; }
        public ZonedDateTime getEndTime() { return endTime; }
        public Long getDurationSeconds() { return durationSeconds; }
    }
}
