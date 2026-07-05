package project.TimeManager.application.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import project.TimeManager.application.service.MemberDayBoundarySettingsCache.Settings;

import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("MemberDayBoundarySettingsCache")
class MemberDayBoundarySettingsCacheTest {

    private static final Long MEMBER_ID = 1L;

    MemberDayBoundarySettingsCache cache;

    @BeforeEach
    void setUp() {
        cache = new MemberDayBoundarySettingsCache();
    }

    @Test
    @DisplayName("값이 없으면 empty를 반환한다")
    void get_missingEntry_returnsEmpty() {
        assertThat(cache.get(MEMBER_ID)).isEmpty();
    }

    @Test
    @DisplayName("put한 값을 get으로 그대로 조회한다")
    void putThenGet_returnsSameSettings() {
        Settings settings = new Settings(ZoneId.of("Asia/Seoul"), 5);

        cache.put(MEMBER_ID, settings);

        assertThat(cache.get(MEMBER_ID)).contains(settings);
    }

    @Test
    @DisplayName("evict 후에는 다시 empty를 반환한다")
    void evict_removesEntry() {
        cache.put(MEMBER_ID, new Settings(ZoneId.of("Asia/Seoul"), 5));

        cache.evict(MEMBER_ID);

        assertThat(cache.get(MEMBER_ID)).isEmpty();
    }

    @Test
    @DisplayName("존재하지 않는 회원을 evict해도 예외가 나지 않는다")
    void evict_unknownMember_doesNotThrow() {
        cache.evict(999L);
    }
}
