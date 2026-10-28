import { describe, expect, it } from 'vitest'
import { recordDefaults, wallTime, wallTimeToIso } from './recordDateTime'

describe('record wall clocks', () => {
  it('uses profile timezone and round trips a user-edited date', () => {
    expect(wallTimeToIso('2026-10-01T03:15', 'Asia/Seoul')).toBe('2026-09-30T18:15:00.000Z')
    expect(wallTime(new Date('2026-09-30T18:15Z'), 'Asia/Seoul')).toBe('2026-10-01T03:15')
  })
  it('anchors a past logical day at the reset hour', () => {
    expect(recordDefaults('2026-10-01', 5, 'Asia/Seoul')).toEqual({ start: '2026-10-01T05:00', end: '2026-10-01T06:00' })
  })
  it('rejects nonexistent DST wall clocks and invalid dates', () => {
    expect(() => wallTimeToIso('2026-03-08T02:30', 'America/New_York')).toThrow()
    expect(() => wallTimeToIso('2026-02-30T10:00', 'Asia/Seoul')).toThrow()
  })
  it('preserves the later repeated DST clock when an existing input is untouched', () => {
    expect(wallTimeToIso('2026-11-01T01:30', 'America/New_York', '2026-11-01T06:30:24Z')).toBe('2026-11-01T06:30:24.000Z')
    expect(recordDefaults('2026-03-08', 2, 'America/New_York')).toEqual({ start: '2026-03-08T03:00', end: '2026-03-08T04:00' })
  })
})
