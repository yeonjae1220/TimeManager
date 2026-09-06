import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { findRepoRoot, readRepoFile } from '@/test-utils/repoRoot'
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
  serverTimerChangedAt,
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

// ── 서버 최종 변경시각 판정 ─────────────────────────────────────────────────
// "서버가 이 타이머를 마지막으로 바꾼 시각"은 로컬 스냅샷과 서버 중 무엇을 믿을지 가르는
// 기준인데, 같은 계산이 useTagTimer·tagStore·shouldApplyResetTimerMarker 세 곳에 각자
// 복제돼 있었다. 한 곳만 고치면 나머지가 조용히 남는 자리라 한 정의로 모은다.
describe('serverTimerChangedAt', () => {
  it('시작·정지 중 나중 시각을 고른다', () => {
    expect(serverTimerChangedAt(1000, 2000)).toBe(2000)
    expect(serverTimerChangedAt(3000, 2000)).toBe(3000)
  })

  it('서버가 이 타이머를 건드린 적 없으면(null·undefined·EPOCH) 0이다', () => {
    // 0을 돌려줘야 "아직 서버에 안 닿은 오프라인 조작"이 로컬 스냅샷으로 이긴다.
    // 여기서 0이 아닌 값을 내면 신규 태그의 오프라인 시작이 통째로 무시된다.
    expect(serverTimerChangedAt(null, null)).toBe(0)
    expect(serverTimerChangedAt(undefined, undefined)).toBe(0)
    expect(serverTimerChangedAt(0, 0)).toBe(0)
    expect(serverTimerChangedAt(null, 0)).toBe(0)
  })

  it('한쪽만 값이 있으면 그 값을 쓴다', () => {
    expect(serverTimerChangedAt(null, 5000)).toBe(5000)
    expect(serverTimerChangedAt(5000, null)).toBe(5000)
  })

  it('숫자가 아닌 값(NaN 등)은 0으로 강등한다', () => {
    // 타입에 number 라고 적혀 있어도 응답은 검증된 적이 없다. NaN 이 그대로 흐르면
    // 모든 비교가 false 가 되어 "서버가 항상 이긴다"로 조용히 뒤집힌다.
    expect(serverTimerChangedAt(Number.NaN, 1000)).toBe(1000)
    expect(serverTimerChangedAt(Number.NaN, Number.NaN)).toBe(0)
    expect(serverTimerChangedAt(Number.POSITIVE_INFINITY, 1000)).toBe(1000)
  })

  // 이 계산이 다시 복제되면 한 곳만 고쳐지고 나머지는 조용히 남는다. 실제로 그렇게 세 벌이
  // 생겼고, 그중 하나가 서버 정지시각 후퇴를 못 걸러 유령 러닝을 부활시켰다.
  //
  // 규칙은 "Math.max 를 쓰지 마라"가 아니다 — 원래 복제본 중 하나는 Math.max 없이
  // `savedAt > (a || 0) && savedAt > (b || 0)` 형태였고 그런 가드는 그걸 못 잡는다.
  // 두 필드를 함께 들여다보는 파일은 반드시 공유 함수를 거치게 한다.
  it('두 타임스탬프를 함께 읽는 파일은 serverTimerChangedAt 을 거친다', () => {
    const root = findRepoRoot()
    const srcDir = join(root, 'frontend/src')

    const files: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) files.push(full)
      }
    }
    walk(srcDir)
    expect(files.length, 'src 를 못 훑었습니다 — 이 테스트가 무의미해집니다').toBeGreaterThan(20)

    const DEFINITION = join(srcDir, 'utils/timerPersistence.ts')
    const offenders = files
      .filter((full) => full !== DEFINITION)
      .filter((full) => {
        const source = readRepoFile(full.slice(root.length + 1))
        const readsBoth =
          source.includes('latestStartTimeMs') && source.includes('latestStopTimeMs')
        return readsBoth && !source.includes('serverTimerChangedAt')
      })
      .map((full) => full.slice(srcDir.length + 1))

    expect(offenders, '두 타임스탬프를 직접 비교하는 파일이 있습니다 — serverTimerChangedAt 을 쓰세요')
      .toEqual([])
  })

})
