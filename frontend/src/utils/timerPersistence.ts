'use client'

const TIMER_KEY = 'timemgr-timer'
const PENDING_TIMER_OPS_KEY = 'timemgr-pending-timer-ops'
const RESET_MARKER_KEY = 'timemgr-reset-marker'
const RESET_MARKER_TTL_MS = 60_000

// 대기 중인 타이머 op의 보관 기한. record 큐(BackgroundSyncPlugin maxRetentionTime)와
// 같은 24시간으로 맞춘다. 기한이 없으면 며칠 뒤 복귀했을 때 잊고 있던 조작이 되살아나
// 사용자가 설명할 수 없는 기록이 생긴다.
export const PENDING_OP_TTL_MS = 24 * 60 * 60 * 1000

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
    if (!Array.isArray(parsed)) return []

    // 리셋 마커와 같은 방식으로 읽을 때 만료분을 걷어낸다(pruneResetMarkers 참조).
    const cutoff = Date.now() - PENDING_OP_TTL_MS
    const alive = parsed.filter(
      (op: PendingTimerOperation) => typeof op?.savedAt === 'number' && op.savedAt > cutoff
    )
    if (alive.length !== parsed.length) {
      if (alive.length === 0) localStorage.removeItem(PENDING_TIMER_OPS_KEY)
      else localStorage.setItem(PENDING_TIMER_OPS_KEY, JSON.stringify(alive))
    }
    return alive
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

// 리셋 마커는 태그별로 보관한다(단일 슬롯이면 여러 태그를 60초 내 연속 리셋할 때 덮여 유실됨).
type ResetMarkerMap = Record<string, ResetTimerMarker>

function readResetMarkers(): ResetMarkerMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(RESET_MARKER_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    // 레거시(단일 마커 객체) 마이그레이션
    if (parsed && parsed.kind === 'reset' && typeof parsed.tagId === 'number') {
      return { [parsed.tagId]: parsed as ResetTimerMarker }
    }
    return parsed && typeof parsed === 'object' ? (parsed as ResetMarkerMap) : {}
  } catch {
    localStorage.removeItem(RESET_MARKER_KEY)
    return {}
  }
}

function writeResetMarkers(map: ResetMarkerMap): void {
  if (Object.keys(map).length === 0) {
    localStorage.removeItem(RESET_MARKER_KEY)
    return
  }
  localStorage.setItem(RESET_MARKER_KEY, JSON.stringify(map))
}

// 만료된 마커를 제거하고 남은 맵을 반환.
function pruneResetMarkers(): ResetMarkerMap {
  const map = readResetMarkers()
  const now = Date.now()
  let changed = false
  for (const [key, marker] of Object.entries(map)) {
    if (!marker || marker.kind !== 'reset' || marker.expiresAt <= now) {
      delete map[key]
      changed = true
    }
  }
  if (changed) writeResetMarkers(map)
  return map
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
  const map = pruneResetMarkers()
  map[tagId] = marker
  writeResetMarkers(map)
  return marker
}

export function peekResetTimerMarker(tagId?: number): ResetTimerMarker | null {
  if (typeof window === 'undefined') return null
  const map = pruneResetMarkers()
  if (tagId !== undefined) return map[tagId] ?? null
  return Object.values(map)[0] ?? null
}

export function peekResetTimerMarkers(): ResetTimerMarker[] {
  if (typeof window === 'undefined') return []
  return Object.values(pruneResetMarkers())
}

export function clearResetTimerMarker(tagId?: number): void {
  if (typeof window === 'undefined') return
  if (tagId === undefined) {
    localStorage.removeItem(RESET_MARKER_KEY)
    return
  }
  const map = readResetMarkers()
  if (map[tagId]) {
    delete map[tagId]
    writeResetMarkers(map)
  }
}

// 태그 삭제(discard) 등으로 태그가 사라질 때, 그 태그의 로컬 타이머 잔재를 정리한다.
// 남겨두면 유령 러닝(타이머 상태) 또는 큐 정체(사라진 태그 대상 pending op의 404)를 유발.
export function forgetTagTimerLocally(tagId: number): void {
  if (typeof window === 'undefined') return
  const active = peekTimerState()
  if (active?.tagId === tagId) clearTimerState()

  const remaining = peekPendingTimerOperations().filter((op) => op.tagId !== tagId)
  if (remaining.length === 0) {
    localStorage.removeItem(PENDING_TIMER_OPS_KEY)
  } else {
    localStorage.setItem(PENDING_TIMER_OPS_KEY, JSON.stringify(remaining))
  }

  clearResetTimerMarker(tagId)
}

/**
 * 서버가 이 태그의 타이머 상태를 마지막으로 바꾼 시각(ms). 0 은 "서버가 이 타이머를
 * 건드린 적이 없다"는 뜻이다(신규 태그·EPOCH 센티넬).
 *
 * 로컬 스냅샷과 서버 응답 중 무엇을 믿을지 가르는 기준이라 정의가 한 곳이어야 한다 —
 * 예전에는 useTagTimer(computeStopwatchState)·tagStore(applyLocalTimerOverrides)·
 * 이 파일의 리셋 마커 판정이 같은 계산을 각자 복제하고 있었고, 그런 구조는 한 곳만
 * 고쳐지고 나머지가 조용히 남는다.
 *
 * 0 을 돌려주는 것이 곧 "로컬이 이긴다"이므로, 검증되지 않은 응답값(NaN 등)은 0 으로
 * 강등한다 — 그대로 흘리면 모든 비교가 false 가 되어 판정이 통째로 뒤집힌다.
 */
export function serverTimerChangedAt(
  latestStartTimeMs: number | null | undefined,
  latestStopTimeMs: number | null | undefined
): number {
  const finite = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? value : 0
  return Math.max(finite(latestStartTimeMs), finite(latestStopTimeMs))
}

export function shouldApplyResetTimerMarker(
  marker: ResetTimerMarker | null,
  latestStartTimeMs: number | null | undefined,
  latestStopTimeMs: number | null | undefined
): marker is ResetTimerMarker {
  if (!marker || marker.expiresAt <= Date.now()) return false
  return serverTimerChangedAt(latestStartTimeMs, latestStopTimeMs) <= marker.savedAt
}
