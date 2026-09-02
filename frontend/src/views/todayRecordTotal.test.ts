import { describe, expect, it } from 'vitest'
import { computeTodayRecordTotal, resolveTodaySummaryDateParam } from './todayRecordTotal'

describe('computeTodayRecordTotal — 오늘 기록시간 no-drop 불변식', () => {
  // 다른 태그가 오늘 이미 1시간(3600s) 기록된 상태에서 현재 태그를 5분(300s) 실행.
  const OTHER_TAGS = 3600
  const THIS_TAG_DAILY = 300 // 실행 종료 시점 현재 태그 하나의 오늘 누적

  it('실행 중엔 세션 델타만큼 실시간으로 증가한다', () => {
    expect(computeTodayRecordTotal(OTHER_TAGS, 0, 0)).toBe(3600)
    expect(computeTodayRecordTotal(OTHER_TAGS, 120, 120)).toBe(3720)
    expect(computeTodayRecordTotal(OTHER_TAGS, 300, THIS_TAG_DAILY)).toBe(3900)
  })

  it('[회귀] 낙관적 반영 없이 정지하면 세션분이 잠깐 사라진다 (버그 문서화)', () => {
    const running = computeTodayRecordTotal(OTHER_TAGS, 300, THIS_TAG_DAILY) // 3900
    // 정지: runningDelta→0, todayTotalSeconds는 아직 예전 값(3600)
    const naiveStop = computeTodayRecordTotal(OTHER_TAGS, 0, THIS_TAG_DAILY) // 3600
    // 이 호출들은 항상 non-null 인자만 넘기므로 결과도 항상 number다 — null 분기는
    // 아래 별도 테스트가 검증한다.
    expect(naiveStop).toBeLessThan(running as number) // 이전 값으로 하락 = 버그
  })

  it('정지 시 세그먼트를 todayTotalSeconds에 더하면 값이 절대 하락하지 않는다', () => {
    const running = computeTodayRecordTotal(OTHER_TAGS, 300, THIS_TAG_DAILY) // 3900
    // Fix B: setTodayTotalSeconds(s => s + segment) 적용 후 정지 시점
    const optimisticStop = computeTodayRecordTotal(OTHER_TAGS + 300, 0, THIS_TAG_DAILY) // 3900
    expect(optimisticStop).toBeGreaterThanOrEqual(running as number)
    expect(optimisticStop).toBe(3900)
  })

  it('summary가 현재 태그보다 작아도 하한(dailyTotalTimeCal)이 값을 지킨다', () => {
    // 서버 summary가 아직 0(미로드)인데 현재 태그는 이미 500s 누적된 경우
    expect(computeTodayRecordTotal(0, 0, 500)).toBe(500)
  })

  // ── [회귀] "미로드(null)"와 "0건"은 다르다 ──────────────────────────────
  // todayTotalSeconds가 0(요약 도착, 실제로 0건)일 때만 하한 가드가 적용돼야 한다.
  // null(요약 미도착)에도 dailyTotalTimeCal로 값을 지어내면, 캐시 시드로 태그
  // 통계만 먼저 채워진 화면에서 "오늘 태그 기록시간"과 "오늘 기록시간"이 우연히
  // 같은 값으로 보였다가 요약 도착 시 다른 값으로 바뀌는 것처럼 보인다.
  it('[회귀] todayTotalSeconds가 null(요약 미도착)이면 결과도 null이다 — 0으로 위장하지 않는다', () => {
    expect(computeTodayRecordTotal(null, 0, 500)).toBeNull()
    expect(computeTodayRecordTotal(null, 300, 0)).toBeNull()
  })
})

describe('resolveTodaySummaryDateParam — "오늘 기록시간" 조회에 쓸 날짜(resetHour 경계)', () => {
  it('resetHour를 아직 모르면 조회 자체를 미룬다(null)', () => {
    const now = new Date(2026, 7, 23, 14, 0, 0)
    expect(resolveTodaySummaryDateParam(now, null)).toBeNull()
  })

  it('resetHour 이후 시각이면 오늘 날짜를 그대로 쓴다', () => {
    const now = new Date(2026, 7, 23, 14, 0, 0) // 14:00, resetHour=5
    expect(resolveTodaySummaryDateParam(now, 5)).toBe('2026-08-23')
  })

  it('[회귀] 자정~resetHour 사이엔 어제 날짜를 쓴다 — 자정 기준이면 여기서 값이 어긋난다', () => {
    const now = new Date(2026, 7, 23, 2, 0, 0) // 02:00, resetHour=5 → 아직 8/22
    expect(resolveTodaySummaryDateParam(now, 5)).toBe('2026-08-22')
  })

  it('resetHour가 0이면 자정 기준과 동일하다', () => {
    const now = new Date(2026, 7, 23, 0, 30, 0)
    expect(resolveTodaySummaryDateParam(now, 0)).toBe('2026-08-23')
  })

  // ── [회귀] 서버는 회원 프로필의 시간대로 "하루"를 나누는데(RecordSummaryService의
  // ZoneId.of(member.getTimezone())), 클라이언트가 브라우저 로컬 시간대로 날짜
  // 문자열을 만들면 기기 시간대가 프로필 시간대와 다를 때 하루 어긋난 구간을
  // 조회한다. timezone을 명시하면 어느 시스템에서 테스트를 돌려도 그 시간대
  // 기준으로 계산돼야 한다 — 두 시간대(UTC+14/UTC-11)를 비교해 실제로 반영되는지 검증한다.
  it('[회귀] timezone을 넘기면 브라우저(실행 환경) 시간대가 아니라 그 시간대 기준으로 날짜를 계산한다', () => {
    const now = new Date('2026-08-23T12:00:00.000Z')
    // Kiritimati(UTC+14): 2026-08-23T12:00Z → 로컬 2026-08-24 02:00
    expect(resolveTodaySummaryDateParam(now, 0, 'Pacific/Kiritimati')).toBe('2026-08-24')
    // Midway(UTC-11): 2026-08-23T12:00Z → 로컬 2026-08-23 01:00
    expect(resolveTodaySummaryDateParam(now, 0, 'Pacific/Midway')).toBe('2026-08-23')
  })

  it('[회귀] timezone과 resetHour가 함께 적용된다(경계 이동 후 그 시간대에서 날짜를 뽑는다)', () => {
    const now = new Date('2026-08-23T02:00:00.000Z') // resetHour=5 시프트 → 2026-08-22T21:00Z
    expect(resolveTodaySummaryDateParam(now, 5, 'Pacific/Kiritimati')).toBe('2026-08-23') // 21:00Z+14h → 08-23 11:00
    expect(resolveTodaySummaryDateParam(now, 5, 'Pacific/Midway')).toBe('2026-08-22') // 21:00Z-11h → 08-22 10:00
  })

  it('timezone을 넘기지 않으면(undefined) 기존과 동일하게 동작한다(하위 호환)', () => {
    const now = new Date(2026, 7, 23, 14, 0, 0)
    expect(resolveTodaySummaryDateParam(now, 5, undefined)).toBe(resolveTodaySummaryDateParam(now, 5))
  })
})
