package project.TimeManager.domain.record.model;

import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.Objects;

public record TimeRange(ZonedDateTime start, ZonedDateTime end) {

    public TimeRange {
        Objects.requireNonNull(start, "시작 시간은 필수입니다");
        Objects.requireNonNull(end, "종료 시간은 필수입니다");
        if (!end.isAfter(start)) {
            throw new IllegalArgumentException("종료 시간은 시작 시간 이후여야 합니다");
        }
        if (start.toInstant().isAfter(Instant.now())) {
            throw new IllegalArgumentException("시작 시간은 현재 시각 이후일 수 없습니다");
        }
    }

    public long durationInSeconds() {
        return Duration.between(start, end).toSeconds();
    }

    /**
     * 두 시간대가 겹치는지 확인합니다 (절대 시간 기준 — 타임존 무관).
     * 경계가 정확히 맞닿는 경우(연속)는 겹침으로 보지 않습니다.
     */
    public boolean overlaps(TimeRange other) {
        return this.start.toInstant().isBefore(other.end().toInstant())
                && other.start().toInstant().isBefore(this.end.toInstant());
    }

    public TimeRange withStart(ZonedDateTime newStart) {
        return new TimeRange(newStart, this.end);
    }

    public TimeRange withEnd(ZonedDateTime newEnd) {
        return new TimeRange(this.start, newEnd);
    }
}
