import { describe, expect, it } from 'vitest'
import { computeTodayRecordTotal } from './todayRecordTotal'

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
    expect(naiveStop).toBeLessThan(running) // 이전 값으로 하락 = 버그
  })

  it('정지 시 세그먼트를 todayTotalSeconds에 더하면 값이 절대 하락하지 않는다', () => {
    const running = computeTodayRecordTotal(OTHER_TAGS, 300, THIS_TAG_DAILY) // 3900
    // Fix B: setTodayTotalSeconds(s => s + segment) 적용 후 정지 시점
    const optimisticStop = computeTodayRecordTotal(OTHER_TAGS + 300, 0, THIS_TAG_DAILY) // 3900
    expect(optimisticStop).toBeGreaterThanOrEqual(running)
    expect(optimisticStop).toBe(3900)
  })

  it('summary가 현재 태그보다 작아도 하한(dailyTotalTimeCal)이 값을 지킨다', () => {
    // 서버 summary가 아직 0(미로드)인데 현재 태그는 이미 500s 누적된 경우
    expect(computeTodayRecordTotal(0, 0, 500)).toBe(500)
  })
})
