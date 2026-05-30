'use client'

const TIMER_KEY = 'timemgr-timer'

export interface TimerState {
  tagId: number
  isRunning: boolean
  elapsedTime: number
  latestStartTime: number | null
  latestEndTime: number | null
  latestStopTimeMs: number | null
  dailyTotalTime: number
  dailyGoalTime: number
  savedAt: number
  retryAttempted: boolean
}

export function peekTimerState(): TimerState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(TIMER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveTimerState(state: Omit<TimerState, 'savedAt' | 'retryAttempted'>): void {
  const existing = peekTimerState()
  localStorage.setItem(TIMER_KEY, JSON.stringify({
    ...state,
    savedAt: Date.now(),
    retryAttempted: existing?.retryAttempted ?? false,
  }))
}

export function clearTimerState(): void {
  localStorage.removeItem(TIMER_KEY)
}

export function markRetryAttempted(): void {
  const state = peekTimerState()
  if (state) {
    localStorage.setItem(TIMER_KEY, JSON.stringify({ ...state, retryAttempted: true }))
  }
}

export function clearRetryAttempted(): void {
  const state = peekTimerState()
  if (state) {
    localStorage.setItem(TIMER_KEY, JSON.stringify({ ...state, retryAttempted: false }))
  }
}
