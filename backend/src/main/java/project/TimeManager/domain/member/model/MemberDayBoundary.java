package project.TimeManager.domain.member.model;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;

public final class MemberDayBoundary {
    private MemberDayBoundary() {}

    // Keep the existing elapsed-hours rule used by the stats UI and historical reports.
    public static ZonedDateTime startOf(LocalDate day, ZoneId zone, int resetHour) {
        return day.atStartOfDay(zone).plusHours(resetHour);
    }

    public static LocalDate dateOf(ZonedDateTime instant, ZoneId zone, int resetHour) {
        return instant.minusHours(resetHour).withZoneSameInstant(zone).toLocalDate();
    }
}
