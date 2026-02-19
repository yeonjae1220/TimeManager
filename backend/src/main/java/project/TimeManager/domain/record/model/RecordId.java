package project.TimeManager.domain.record.model;

public record RecordId(Long value) {
    public static RecordId of(Long value) {
        return new RecordId(value);
    }
}
