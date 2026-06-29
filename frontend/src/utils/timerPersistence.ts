'use client'

const TIMER_KEY = 'timemgr-timer'
const PENDING_TIMER_OPS_KEY = 'timemgr-pending-timer-ops'
const RESET_MARKER_KEY = 'timemgr-reset-marker'
const RESET_MARKER_TTL_MS = 60_000

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
}

export type PendingTimerOperation =
  | {
      id: string
      type: 'start'
      tagId: number
      latestStartTime: number
      savedAt: number
      retryAttempted: boolean
    }
  | {
      id: string
      type: 'stop'
      tagId: number
      elapsedTime: number
      latestStartTime: number
      latestEndTime: number
      savedAt: number
      retryAttempted: boolean
    }
  | {
      id: string
      type: 'reset'
      tagId: number
      elapsedTime: number
      savedAt: number
      retryAttempted: boolean
    }

export type PendingTimerOperationInput =
  | {
      type: 'start'
      tagId: number
      latestStartTime: number
    }
  | {
      type: 'stop'
      tagId: number
      elapsedTime: number
      latestStartTime: number
      latestEndTime: number
    }
  | {
      type: 'reset'
      tagId: number
      elapsedTime: number
    }

export interface ResetTimerMarker {
  kind: 'reset'
  tagId: number
  savedAt: number
  expiresAt: number
}

function isTimerState(value: unknown): value is TimerState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<TimerState>
  return (
    typeof state.tagId === 'number' &&
    typeof state.isRunning === 'boolean' &&
    typeof state.elapsedTime === 'number' &&
    typeof state.dailyTotalTime === 'number' &&
    typeof state.dailyGoalTime === 'number' &&
    typeof state.savedAt === 'number'
  )
}

function normalizeTimerState(state: TimerState & { retryAttempted?: boolean }): TimerState {
  const { retryAttempted: _legacyRetryAttempted, ...normalized } = state
  return normalized
}

export function peekTimerState(): TimerState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(TIMER_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!isTimerState(parsed)) {
      localStorage.removeItem(TIMER_KEY)
      return null
    }

    const normalized = normalizeTimerState(parsed)
    if ('retryAttempted' in parsed) {
      localStorage.setItem(TIMER_KEY, JSON.stringify(normalized))
    }
    return normalized
  } catch {
    localStorage.removeItem(TIMER_KEY)
    return null
  }
}

export function saveTimerState(state: Omit<TimerState, 'savedAt'>): void {
  localStorage.setItem(TIMER_KEY, JSON.stringify({
    ...state,
    savedAt: Date.now(),
  }))
}

export function clearTimerState(): void {
  localStorage.removeItem(TIMER_KEY)
}

export function peekPendingTimerOperations(): PendingTimerOperation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(PENDING_TIMER_OPS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function peekPendingTimerOperation(): PendingTimerOperation | null {
  return peekPendingTimerOperations()[0] ?? null
}

export function enqueuePendingTimerOperation(
  operation: PendingTimerOperationInput
): void {
  if (typeof window === 'undefined') return
  const now = Date.now()
  const next = [
    ...peekPendingTimerOperations(),
    {
      ...operation,
      id: `${now}-${Math.random().toString(36).slice(2)}`,
      savedAt: now,
      retryAttempted: false,
    } as PendingTimerOperation,
  ]
  localStorage.setItem(PENDING_TIMER_OPS_KEY, JSON.stringify(next))
}

export function removePendingTimerOperation(id: string): void {
  if (typeof window === 'undefined') return
  const next = peekPendingTimerOperations().filter((operation) => operation.id !== id)
  if (next.length === 0) {
    localStorage.removeItem(PENDING_TIMER_OPS_KEY)
    return
  }
  localStorage.setItem(PENDING_TIMER_OPS_KEY, JSON.stringify(next))
}

export function clearPendingTimerOperations(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(PENDING_TIMER_OPS_KEY)
}

export function markRetryAttempted(id?: string): void {
  const operations = peekPendingTimerOperations()
  const targetId = id ?? operations[0]?.id
  if (!targetId) return

  const next = operations.map((operation) =>
    operation.id === targetId ? { ...operation, retryAttempted: true } : operation
  )
  localStorage.setItem(PENDING_TIMER_OPS_KEY, JSON.stringify(next))
}

export function clearRetryAttempted(id?: string): void {
  const operations = peekPendingTimerOperations()
  const targetId = id ?? operations[0]?.id
  if (!targetId) return

  const next = operations.map((operation) =>
    operation.id === targetId ? { ...operation, retryAttempted: false } : operation
  )
  localStorage.setItem(PENDING_TIMER_OPS_KEY, JSON.stringify(next))
}

export function saveResetTimerMarker(tagId: number, ttlMs = RESET_MARKER_TTL_MS): ResetTimerMarker | null {
  if (typeof window === 'undefined') return null
  const savedAt = Date.now()
  const marker: ResetTimerMarker = {
    kind: 'reset',
    tagId,
    savedAt,
    expiresAt: savedAt + ttlMs,
  }
  localStorage.setItem(RESET_MARKER_KEY, JSON.stringify(marker))
  return marker
}

export function peekResetTimerMarker(tagId?: number): ResetTimerMarker | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(RESET_MARKER_KEY)
    if (!raw) return null
    const marker = JSON.parse(raw) as ResetTimerMarker
    if (marker.kind !== 'reset' || marker.expiresAt <= Date.now()) {
      localStorage.removeItem(RESET_MARKER_KEY)
      return null
    }
    if (tagId !== undefined && marker.tagId !== tagId) return null
    return marker
  } catch {
    localStorage.removeItem(RESET_MARKER_KEY)
    return null
  }
}

export function clearResetTimerMarker(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(RESET_MARKER_KEY)
}

export function shouldApplyResetTimerMarker(
  marker: ResetTimerMarker | null,
  latestStartTimeMs: number | null | undefined,
  latestStopTimeMs: number | null | undefined
): marker is ResetTimerMarker {
  if (!marker || marker.expiresAt <= Date.now()) return false
  const serverChangedAt = Math.max(latestStartTimeMs ?? 0, latestStopTimeMs ?? 0)
  return serverChangedAt <= marker.savedAt
}
