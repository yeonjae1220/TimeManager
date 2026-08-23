import { describe, expect, it } from 'vitest'
import { logicalDateOf } from './dayBoundary'

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
