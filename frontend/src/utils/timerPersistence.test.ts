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
})
