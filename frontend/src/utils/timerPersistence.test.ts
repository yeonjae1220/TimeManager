import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearPendingTimerOperations,
  clearResetTimerMarker,
  clearRetryAttempted,
  clearTimerState,
  enqueuePendingTimerOperation,
  markRetryAttempted,
  peekPendingTimerOperation,
  peekPendingTimerOperations,
  peekResetTimerMarker,
  peekTimerState,
  removePendingTimerOperation,
  saveResetTimerMarker,
  saveTimerState,
  shouldApplyResetTimerMarker,
  PENDING_OP_TTL_MS,
} from './timerPersistence'

function makeTimerState(overrides = {}) {
  return {
    tagId: 1,
    isRunning: true,
    latestStartTime: Date.now() - 5000,
    latestEndTime: null,
    latestStopTimeMs: null,
    elapsedTime: 5,
    dailyTotalTime: 100,
    dailyGoalTime: 3600,
    ...overrides,
  }
}

describe('timerPersistence', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-25T00:00:00.000Z'))
  })

  afterEach(() => {
    localStorage.clear()
    vi.useRealTimers()
  })

  it('stores active timer state separately from pending retry state', () => {
    saveTimerState(makeTimerState())
    enqueuePendingTimerOperation({
      type: 'start',
      tagId: 1,
      latestStartTime: Date.now(),
    })

    markRetryAttempted()

    expect(peekTimerState()?.isRunning).toBe(true)
    expect(peekTimerState()).not.toHaveProperty('retryAttempted')
    expect(peekPendingTimerOperation()?.retryAttempted).toBe(true)
  })

  it('removes legacy retryAttempted from active timer storage when read', () => {
    localStorage.setItem('timemgr-timer', JSON.stringify({
      ...makeTimerState(),
      savedAt: Date.now(),
      retryAttempted: true,
    }))

    expect(peekTimerState()).not.toHaveProperty('retryAttempted')
    expect(localStorage.getItem('timemgr-timer')).not.toContain('retryAttempted')
  })

  it('drops malformed active timer storage when read', () => {
    localStorage.setItem('timemgr-timer', JSON.stringify({ retryAttempted: true }))

    expect(peekTimerState()).toBeNull()
    expect(localStorage.getItem('timemgr-timer')).toBeNull()
  })

  it('preserves pending operation order', () => {
    enqueuePendingTimerOperation({
      type: 'stop',
      tagId: 1,
      elapsedTime: 10,
      latestStartTime: 1000,
      latestEndTime: 11000,
    })
    enqueuePendingTimerOperation({
      type: 'reset',
      tagId: 1,
      elapsedTime: 0,
    })

    const operations = peekPendingTimerOperations()
    expect(operations.map((operation) => operation.type)).toEqual(['stop', 'reset'])

    removePendingTimerOperation(operations[0].id)
    expect(peekPendingTimerOperation()?.type).toBe('reset')
  })

  it('clears retryAttempted only on the targeted pending operation', () => {
    enqueuePendingTimerOperation({
      type: 'start',
      tagId: 1,
      latestStartTime: 1000,
    })

    const pending = peekPendingTimerOperation()
    expect(pending).not.toBeNull()

    markRetryAttempted(pending!.id)
    expect(peekPendingTimerOperation()?.retryAttempted).toBe(true)

    clearRetryAttempted(pending!.id)
    expect(peekPendingTimerOperation()?.retryAttempted).toBe(false)
  })

  it('expires reset marker after its ttl', () => {
    const marker = saveResetTimerMarker(7, 1000)
    expect(marker?.tagId).toBe(7)
    expect(peekResetTimerMarker(7)).not.toBeNull()

    vi.advanceTimersByTime(1001)

    expect(peekResetTimerMarker(7)).toBeNull()
  })

  it('applies reset marker only until the server has a newer timer timestamp', () => {
    const marker = saveResetTimerMarker(7, 1000)
    expect(shouldApplyResetTimerMarker(marker, Date.now() - 1, null)).toBe(true)
    expect(shouldApplyResetTimerMarker(marker, Date.now() + 1, null)).toBe(false)
  })

  it('clears independent storage buckets independently', () => {
    saveTimerState(makeTimerState())
    enqueuePendingTimerOperation({
      type: 'reset',
      tagId: 1,
      elapsedTime: 0,
    })
    saveResetTimerMarker(1)

    clearTimerState()
    expect(peekTimerState()).toBeNull()
    expect(peekPendingTimerOperation()).not.toBeNull()
    expect(peekResetTimerMarker(1)).not.toBeNull()

    clearPendingTimerOperations()
    clearResetTimerMarker()
    expect(peekPendingTimerOperation()).toBeNull()
    expect(peekResetTimerMarker(1)).toBeNull()
  })

  it('[⑨마커단일슬롯] 두 태그를 60초 내 연속 리셋해도 각 태그의 리셋 마커가 유지된다', () => {
    saveResetTimerMarker(1)
    saveResetTimerMarker(2)

    // 현재는 단일 슬롯이라 태그1 마커가 태그2로 덮여 사라진다 → RED (설계 한계 문서화)
    expect(peekResetTimerMarker(1)).not.toBeNull()
    expect(peekResetTimerMarker(2)).not.toBeNull()
  })

  // ── EC8: 대기 큐 보관 기한 ──────────────────────────────────────────
  // record 큐는 24h(BackgroundSyncPlugin), 리셋 마커는 60s TTL이 있는데 타이머 op만
  // 무기한이었다. 며칠 뒤 복귀 시 옛 조작이 되살아나면 사용자가 이해할 수 없는 기록이 생긴다.
  describe('대기 op 보관 기한', () => {
    it('보관 기한이 지난 op는 조회에서 제외되고 저장소에서도 정리된다', () => {
      enqueuePendingTimerOperation({
        type: 'stop', tagId: 1, elapsedTime: 5,
        latestStartTime: Date.now() - 5000, latestEndTime: Date.now(),
      })
      // 저장된 op를 기한 밖으로 밀어낸다
      const raw = JSON.parse(localStorage.getItem('timemgr-pending-timer-ops')!)
      raw[0].savedAt = Date.now() - (PENDING_OP_TTL_MS + 1000)
      localStorage.setItem('timemgr-pending-timer-ops', JSON.stringify(raw))

      expect(peekPendingTimerOperations()).toHaveLength(0)
      expect(localStorage.getItem('timemgr-pending-timer-ops')).toBeNull()
    })

    it('기한 내 op는 유지된다', () => {
      enqueuePendingTimerOperation({
        type: 'stop', tagId: 1, elapsedTime: 5,
        latestStartTime: Date.now() - 5000, latestEndTime: Date.now(),
      })
      const raw = JSON.parse(localStorage.getItem('timemgr-pending-timer-ops')!)
      raw[0].savedAt = Date.now() - (PENDING_OP_TTL_MS - 60_000)
      localStorage.setItem('timemgr-pending-timer-ops', JSON.stringify(raw))

      expect(peekPendingTimerOperations()).toHaveLength(1)
    })

    it('만료된 op만 걸러내고 유효한 op의 순서는 보존한다', () => {
      enqueuePendingTimerOperation({ type: 'start', tagId: 1, latestStartTime: Date.now() })
      enqueuePendingTimerOperation({ type: 'reset', tagId: 2, elapsedTime: 0 })
      const raw = JSON.parse(localStorage.getItem('timemgr-pending-timer-ops')!)
      raw[0].savedAt = Date.now() - (PENDING_OP_TTL_MS + 1000)  // 첫 번째만 만료
      localStorage.setItem('timemgr-pending-timer-ops', JSON.stringify(raw))

      const remaining = peekPendingTimerOperations()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].type).toBe('reset')
      expect(remaining[0].tagId).toBe(2)
    })
  })

})
