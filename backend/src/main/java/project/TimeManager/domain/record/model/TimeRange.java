package project.TimeManager.domain.record.model;

import java.time.Duration;
import java.time.ZonedDateTime;
import java.util.Objects;

public record TimeRange(ZonedDateTime start, ZonedDateTime end) {

    public TimeRange {
        Objects.requireNonNull(start, "시작 시간은 필수입니다");
        Objects.requireNonNull(end, "종료 시간은 필수입니다");
        if (!end.isAfter(start)) {
            throw new IllegalArgumentException("종료 시간은 시작 시간 이후여야 합니다");
        }
    }

    public long durationInSeconds() {
        return Duration.between(start, end).toSeconds();
    }

    public TimeRange withStart(ZonedDateTime newStart) {
        return new TimeRange(newStart, this.end);
    }

    public TimeRange withEnd(ZonedDateTime newEnd) {
        return new TimeRange(this.start, newEnd);
    }
}
