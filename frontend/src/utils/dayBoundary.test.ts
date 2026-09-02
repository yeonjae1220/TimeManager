import { describe, expect, it } from 'vitest'
import { logicalDateOf, logicalDateStringOf } from './dayBoundary'

describe('logicalDateOf — 05시 등 초기화 시각 기준으로 "논리적 오늘"을 계산한다', () => {
  it('초기화 시각 이후면 그날 그대로다', () => {
    // 로컬 2026-08-23 14:00 — resetHour=5 이후이므로 그대로 8/23이어야 한다
    const d = new Date(2026, 7, 23, 14, 0, 0)
    const result = logicalDateOf(d, 5)
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(7)
    expect(result.getDate()).toBe(23)
  })

  it('초기화 시각 이전(자정~05시)이면 전날로 계산된다', () => {
    // 로컬 2026-08-23 02:00 — resetHour=5 이전이므로 논리적으로는 아직 8/22다
    const d = new Date(2026, 7, 23, 2, 0, 0)
    const result = logicalDateOf(d, 5)
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(7)
    expect(result.getDate()).toBe(22)
  })

  it('정확히 초기화 시각(05:00:00)이면 그날로 취급한다(경계 포함)', () => {
    const d = new Date(2026, 7, 23, 5, 0, 0)
    const result = logicalDateOf(d, 5)
    expect(result.getDate()).toBe(23)
  })

  it('resetHour가 0이면 자정 기준(달력 날짜)과 동일하다', () => {
    const d = new Date(2026, 7, 23, 1, 0, 0)
    const result = logicalDateOf(d, 0)
    expect(result.getDate()).toBe(23)
  })

  it('월 경계를 넘어가도 정확히 계산된다', () => {
    // 2026-09-01 03:00, resetHour=5 → 논리적으로 8/31
    const d = new Date(2026, 8, 1, 3, 0, 0)
    const result = logicalDateOf(d, 5)
    expect(result.getMonth()).toBe(7)
    expect(result.getDate()).toBe(31)
  })
})

describe('logicalDateStringOf — 서버 쿼리와 같은 규칙의 "YYYY-MM-DD" 버킷 키', () => {
  it('초기화 시각 이전(자정~05시)이면 전날 날짜 문자열을 준다', () => {
    // 히트맵이 예전에 달력 날짜(2026-09-02)로 모아 주별 막대·일별 탭과 어긋나던 경우.
    expect(logicalDateStringOf(new Date(2026, 8, 2, 2, 0, 0), 5)).toBe('2026-09-01')
  })

  it('초기화 시각 이후면 달력 날짜와 같다', () => {
    expect(logicalDateStringOf(new Date(2026, 8, 2, 14, 0, 0), 5)).toBe('2026-09-02')
  })

  it('resetHour가 0이면 언제나 달력 날짜다', () => {
    expect(logicalDateStringOf(new Date(2026, 8, 2, 1, 0, 0), 0)).toBe('2026-09-02')
  })

  it('월 경계를 넘어가도 자리수를 채운 형식을 유지한다', () => {
    expect(logicalDateStringOf(new Date(2026, 8, 1, 3, 0, 0), 5)).toBe('2026-08-31')
  })

  it('timeZone을 주면 그 시간대의 날짜로 만든다 — 기기 시간대가 프로필과 달라도 서버와 같은 하루를 가리킨다', () => {
    // 2026-09-02T20:00Z 는 UTC로는 9/2지만 Asia/Seoul(+9)로는 9/3 05:00 이다.
    // resetHour=5 이므로 서울 기준 논리적 날짜는 9/3이 된다.
    const instant = new Date(Date.UTC(2026, 8, 2, 20, 0, 0))
    expect(logicalDateStringOf(instant, 5, 'Asia/Seoul')).toBe('2026-09-03')
    expect(logicalDateStringOf(instant, 5, 'UTC')).toBe('2026-09-02')
  })
})
