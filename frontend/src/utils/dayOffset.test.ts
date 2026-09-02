import { describe, expect, it } from 'vitest'
import { dayOffsetSuffix } from './dayOffset'

describe('dayOffsetSuffix — 종료가 다른 날인 세션에 붙는 꼬리표', () => {
  it('같은 날에 끝나면 꼬리표가 없다', () => {
    const start = new Date(2026, 8, 1, 13, 0, 0)
    const end = new Date(2026, 8, 1, 14, 30, 0)
    expect(dayOffsetSuffix(start, end)).toBeNull()
  })

  it('자정을 넘기면 (+1)', () => {
    // 23:00 → 01:30. 시:분만 보면 시간이 거꾸로 흐른 것처럼 읽히는 바로 그 경우다.
    const start = new Date(2026, 8, 1, 23, 0, 0)
    const end = new Date(2026, 8, 2, 1, 30, 0)
    expect(dayOffsetSuffix(start, end)).toBe('(+1)')
  })

  it('정지를 잊어 이틀을 넘기면 (+2)', () => {
    const start = new Date(2026, 8, 1, 23, 0, 0)
    const end = new Date(2026, 8, 3, 1, 30, 0)
    expect(dayOffsetSuffix(start, end)).toBe('(+2)')
  })

  it('자정 직전 1분 차이여도 날짜가 바뀌면 (+1)', () => {
    const start = new Date(2026, 8, 1, 23, 59, 30)
    const end = new Date(2026, 8, 2, 0, 0, 30)
    expect(dayOffsetSuffix(start, end)).toBe('(+1)')
  })

  it('23시간 59분이어도 같은 날 안이면 꼬리표가 없다 — 기준은 길이가 아니라 날짜다', () => {
    const start = new Date(2026, 8, 1, 0, 0, 30)
    const end = new Date(2026, 8, 1, 23, 59, 30)
    expect(dayOffsetSuffix(start, end)).toBeNull()
  })

  it('월·해 경계를 넘어도 하루는 하루다', () => {
    expect(dayOffsetSuffix(new Date(2026, 7, 31, 23, 0), new Date(2026, 8, 1, 1, 0))).toBe('(+1)')
    expect(dayOffsetSuffix(new Date(2026, 11, 31, 23, 0), new Date(2027, 0, 1, 1, 0))).toBe('(+1)')
  })

  it('종료가 시작보다 이르면(있을 수 없는 데이터) 꼬리표를 붙이지 않는다', () => {
    const start = new Date(2026, 8, 2, 1, 0, 0)
    const end = new Date(2026, 8, 1, 23, 0, 0)
    expect(dayOffsetSuffix(start, end)).toBeNull()
  })
})
