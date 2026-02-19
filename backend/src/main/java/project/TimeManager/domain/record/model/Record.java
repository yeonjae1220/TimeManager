package project.TimeManager.domain.record.model;

import project.TimeManager.domain.tag.model.TagId;

public class Record {

    private RecordId id;
    private TagId tagId;
    private TimeRange timeRange;
    private Long totalTime;

    private Record() {}

    public static Record create(TagId tagId, TimeRange timeRange) {
        Record record = new Record();
        record.tagId = tagId;
        record.timeRange = timeRange;
        record.totalTime = timeRange.durationInSeconds();
        return record;
    }

    public static Record reconstitute(RecordId id, TagId tagId, TimeRange timeRange, Long totalTime) {
        Record record = new Record();
        record.id = id;
        record.tagId = tagId;
        record.timeRange = timeRange;
        record.totalTime = totalTime;
        return record;
    }

    public void editTimeRange(TimeRange newTimeRange) {
        this.timeRange = newTimeRange;
        this.totalTime = newTimeRange.durationInSeconds();
    }

    public void moveToTag(TagId newTagId) {
        this.tagId = newTagId;
    }

    public RecordId getId() { return id; }
    public TagId getTagId() { return tagId; }
    public TimeRange getTimeRange() { return timeRange; }
    public Long getTotalTime() { return totalTime; }
}
