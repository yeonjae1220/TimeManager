import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'

// 네트워크(axios 인스턴스)만 mock — 훅과 스토어는 실제 코드를 그대로 사용해
// start/stop/reset 전 과정을 end-to-end로 검증한다.
vi.mock('@/utils/apiClient', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

import apiClient from '@/utils/apiClient'
import { useTagTimer } from './useTagTimer'
import { useTagStore } from '@/store/tagStore'
import {
  peekPendingTimerOperations,
  peekResetTimerMarker,
  peekTimerState,
  saveResetTimerMarker,
  saveTimerState,
} from '@/utils/timerPersistence'

const get = apiClient.get as unknown as ReturnType<typeof vi.fn>
const post = apiClient.post as unknown as ReturnType<typeof vi.fn>

const startCalls = () => post.mock.calls.filter((c) => String(c[0]).includes('/timer/start'))
const stopCalls = () => post.mock.calls.filter((c) => String(c[0]).includes('/timer/stop'))
const resetCalls = () => post.mock.calls.filter((c) => String(c[0]).includes('/timer/reset'))
const opTypes = () => peekPendingTimerOperations().map((o) => o.type)

function tagPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Ovlo',
    type: 'LEAF',
    memberId: 7,
    children: [],
    state: false,
    elapsedTime: 0,
    dailyTotalTime: 0,
    dailyGoalTime: 0,
    tagTotalTime: 0,
    totalTime: 0,
    latestStartTimeMs: null,
    latestStopTimeMs: Date.now() - 100_000,
    ...overrides,
  }
}

// 태그를 로드해 훅을 "start 버튼 누르기 직전(정지)" 상태로 만든다.
async function renderWithTag(tagOverrides: Record<string, unknown> = {}) {
  get.mockResolvedValue({ data: tagPayload(tagOverrides) })
  const view = renderHook(() => useTagTimer())
  await act(async () => {
    await view.result.current.loadTag(1, 7)
  })
  return view
}

// 오프라인(응답 없는 네트워크 에러)을 한 번 발생시킨다.
const failNextOnce = () => post.mockRejectedValueOnce({})
// 재접속 후 큐 재생.
const reconnectAndFlush = () =>
  act(async () => {
    await useTagStore.getState().retryPendingTimerOp()
  })

beforeEach(() => {
  localStorage.clear()
  post.mockReset()
  get.mockReset()
  post.mockResolvedValue({ data: {} })
  useTagStore.setState({
    isRefreshing: false,
    _pendingRefreshMemberId: null,
    _activeMemberId: 7,
    tagTree: [],
    lastFetchedAt: null,
  })
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('useTagTimer — 타이머 생명주기 전 경우의 수', () => {
  // ── start 버튼 누르기 전/후 ──────────────────────────────────────────────

  it('[start 전·idle] 정지된 태그를 로드만 하면 타이머 상태도 대기 큐도 생성되지 않는다', async () => {
    const { result } = await renderWithTag()

    expect(result.current.sw.isRunning).toBe(false)
    expect(peekTimerState()).toBeNull()
    expect(peekPendingTimerOperations()).toHaveLength(0)
  })

  it('[start·온라인] 성공 시 로컬 타이머가 running으로 저장되고 대기 큐는 비어 있다', async () => {
    const { result } = await renderWithTag()

    await act(async () => {
      await result.current.startStopwatch()
    })

    expect(startCalls()).toHaveLength(1)
    expect(peekTimerState()).toMatchObject({ tagId: 1, isRunning: true })
    expect(peekPendingTimerOperations()).toHaveLength(0)
    expect(result.current.sw.isRunning).toBe(true)
  })

  it('[start·오프라인] 실패해도 running 의도를 로컬과 대기 큐에 보존한다', async () => {
    const { result } = await renderWithTag()

    failNextOnce()
    await act(async () => {
      await result.current.startStopwatch()
    })

    expect(peekTimerState()).toMatchObject({ tagId: 1, isRunning: true })
    expect(opTypes()).toEqual(['start'])
    expect(result.current.sw.isRunning).toBe(true)
  })

  // ── 작동중 → 오프라인/온라인 ─────────────────────────────────────────────

  it('[작동중·오프라인→재접속] 실행 중 start가 오프라인이었어도 재접속 시 running이 서버에 반영된다', async () => {
    const { result } = await renderWithTag()

    failNextOnce() // start 오프라인
    await act(async () => {
      await result.current.startStopwatch()
    })
    expect(opTypes()).toEqual(['start'])

    post.mockClear()
    await reconnectAndFlush()

    // 로컬이 여전히 running이므로 start는 정당하게 재전송된다
    expect(startCalls()).toHaveLength(1)
    expect(peekPendingTimerOperations()).toHaveLength(0)
  })

  // ── stop 후 → 온라인/오프라인 ────────────────────────────────────────────

  it('[stop·온라인] 성공 시 세션이 기록되고 로컬 타이머가 정리된다', async () => {
    const { result } = await renderWithTag()

    await act(async () => {
      await result.current.startStopwatch()
    })
    await act(async () => {
      await result.current.stopStopwatch()
    })

    expect(stopCalls()).toHaveLength(1)
    expect(peekTimerState()).toBeNull()
    expect(peekPendingTimerOperations()).toHaveLength(0)
    expect(result.current.sw.isRunning).toBe(false)
  })

  it('[stop·오프라인→재접속] 실패한 stop은 큐에 남았다가 재접속 시 세션으로 기록되고 running이 남지 않는다', async () => {
    const { result } = await renderWithTag()

    await act(async () => {
      await result.current.startStopwatch()
    }) // 온라인 start → running
    failNextOnce() // stop 오프라인
    await act(async () => {
      await result.current.stopStopwatch()
    })

    expect(peekTimerState()).toMatchObject({ isRunning: false })
    expect(opTypes()).toEqual(['stop'])

    post.mockClear()
    await reconnectAndFlush()

    expect(stopCalls()).toHaveLength(1) // 세션 기록
    expect(startCalls()).toHaveLength(0) // 유령 러닝 없음
    expect(peekPendingTimerOperations()).toHaveLength(0)
  })

  // ── 핵심 회귀: 고아 start가 유령 러닝을 부활시키지 않는다 ──────────────────

  it('[회귀·핵심] start 오프라인 실패로 남은 고아 start는 stop(온라인) 후 재접속해도 running을 부활시키지 않는다', async () => {
    const { result } = await renderWithTag()

    failNextOnce() // start 오프라인 → 큐[start], timer running
    await act(async () => {
      await result.current.startStopwatch()
    })

    await act(async () => {
      await result.current.stopStopwatch()
    }) // 온라인 stop 성공 → timer clear, 큐[start] 고아 잔존
    expect(peekTimerState()).toBeNull()
    expect(opTypes()).toEqual(['start']) // 고아 확인

    post.mockClear()
    await reconnectAndFlush() // 재접속

    expect(startCalls()).toHaveLength(0) // 고아 start 재전송 안 함
    expect(peekPendingTimerOperations()).toHaveLength(0) // 고아 폐기
  })

  it('[회귀·삭제버튼] 고아 start가 있어도 stop 후 삭제(reset)하면 running이 부활하지 않는다', async () => {
    const { result } = await renderWithTag()

    failNextOnce() // start 오프라인
    await act(async () => {
      await result.current.startStopwatch()
    })
    await act(async () => {
      await result.current.stopStopwatch()
    }) // 온라인 stop
    expect(opTypes()).toEqual(['start']) // 고아

    post.mockClear()
    await act(async () => {
      await result.current.resetStopwatch()
      const p = useTagStore.getState().getRetryPromise()
      if (p) await p
    })

    expect(startCalls()).toHaveLength(0) // 유령 러닝 없음
    expect(resetCalls()).toHaveLength(1) // reset은 서버에 정확히 1번만 전송 (이중 POST 없음)
    expect(peekResetTimerMarker(1)).not.toBeNull() // 리셋 마커 존재
    expect(peekPendingTimerOperations()).toHaveLength(0)
    expect(result.current.sw.elapsedTime).toBe(0)
  })

  it('[reset·대기없음] 대기 op가 없으면 reset을 직접 1번만 POST한다', async () => {
    const { result } = await renderWithTag()

    await act(async () => {
      await result.current.startStopwatch()
    })
    await act(async () => {
      await result.current.stopStopwatch()
    }) // 온라인 stop → 큐 비어 있음
    expect(peekPendingTimerOperations()).toHaveLength(0)

    post.mockClear()
    await act(async () => {
      await result.current.resetStopwatch()
    })

    expect(resetCalls()).toHaveLength(1)
    expect(peekResetTimerMarker(1)).not.toBeNull()
    expect(result.current.sw.elapsedTime).toBe(0)
  })
})

describe('useTagTimer — 추가 엣지케이스 검증 (잠재 버그 스윕)', () => {
  // ── ③ loadTag 3-way 우선순위 (리셋마커 vs 로컬 vs 서버) ────────────────────

  it('[③a·loadTag] 리셋 마커가 서버보다 최신이면 정지+0으로 표시한다', async () => {
    saveResetTimerMarker(1)
    const { result } = await renderWithTag({
      state: true,
      elapsedTime: 100,
      latestStartTimeMs: Date.now() - 200_000,
      latestStopTimeMs: null,
    })
    expect(result.current.sw.isRunning).toBe(false)
    expect(result.current.sw.elapsedTime).toBe(0)
  })

  it('[③b·loadTag] 리셋 후 서버가 더 최신(다른 기기 start)이면 서버 running을 따른다', async () => {
    saveResetTimerMarker(1)
    const { result } = await renderWithTag({
      state: true,
      elapsedTime: 10,
      latestStartTimeMs: Date.now() + 5_000, // 마커 이후에 서버가 start됨
      latestStopTimeMs: null,
    })
    expect(result.current.sw.isRunning).toBe(true)
  })

  it('[③c·loadTag] 로컬 저장이 서버보다 최신이고 running이면 로컬을 따른다', async () => {
    saveTimerState({
      tagId: 1,
      isRunning: true,
      elapsedTime: 42,
      latestStartTime: Date.now(),
      latestEndTime: null,
      latestStopTimeMs: null,
      dailyTotalTime: 0,
      dailyGoalTime: 0,
    })
    const { result } = await renderWithTag({
      state: false,
      elapsedTime: 0,
      latestStartTimeMs: Date.now() - 200_000,
      latestStopTimeMs: Date.now() - 200_000,
    })
    expect(result.current.sw.isRunning).toBe(true)
    expect(result.current.sw.elapsedTime).toBe(42)
  })

  it('[③d·loadTag] 서버가 로컬 저장 이후 변경됐으면 서버(정지)를 따른다', async () => {
    saveTimerState({
      tagId: 1,
      isRunning: true,
      elapsedTime: 42,
      latestStartTime: Date.now() - 10_000,
      latestEndTime: null,
      latestStopTimeMs: null,
      dailyTotalTime: 0,
      dailyGoalTime: 0,
    })
    const { result } = await renderWithTag({
      state: false,
      elapsedTime: 99,
      latestStartTimeMs: null,
      latestStopTimeMs: Date.now() + 10_000, // 로컬 저장 이후 서버가 stop
    })
    expect(result.current.sw.isRunning).toBe(false)
    expect(result.current.sw.elapsedTime).toBe(99)
  })

  // ── ⑤ 단일 활성 타이머 불변식 ────────────────────────────────────────────

  it('[⑤단일타이머] 태그A pending start 후 태그B를 시작하면 최종적으로 B만 running이 된다', async () => {
    const { result } = await renderWithTag({ id: 1 })
    failNextOnce() // A 오프라인 start → 큐[startA], timer=A
    await act(async () => {
      await result.current.startStopwatch()
    })

    get.mockResolvedValue({ data: tagPayload({ id: 2 }) })
    await act(async () => {
      await result.current.loadTag(2, 7)
    })
    await act(async () => {
      await result.current.startStopwatch()
    }) // B 온라인 start → timer=B

    post.mockClear()
    await reconnectAndFlush()

    const startA = post.mock.calls.filter((c) => String(c[0]).includes('/tags/1/timer/start'))
    expect(startA).toHaveLength(0) // A의 고아 start는 폐기 (active=B)
    expect(peekTimerState()).toMatchObject({ tagId: 2, isRunning: true })
  })

  // ── ⑧ 시계 역행 시 elapsed 음수 방지 ─────────────────────────────────────

  it('[⑧시계역행] stop 시점이 start보다 과거여도 elapsed가 음수로 전송되지 않는다', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-08T10:00:10.000Z'))
    const { result } = await renderWithTag()
    await act(async () => {
      await result.current.startStopwatch()
    })
    vi.setSystemTime(new Date('2026-07-08T10:00:00.000Z')) // 시계 10초 역행
    await act(async () => {
      await result.current.stopStopwatch()
    })
    vi.useRealTimers()

    const stopBody = stopCalls()[0]?.[1] as { elapsedTime: number }
    expect(stopBody.elapsedTime).toBeGreaterThanOrEqual(0)
  })

  // ── ⑩ Wake Lock 취득/해제 ───────────────────────────────────────────────

  it('[⑩wakeLock] start 시 화면잠금을 취득하고 stop 시 해제한다', async () => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    const release = vi.fn().mockResolvedValue(undefined)
    const sentinel = { release, addEventListener: vi.fn(), removeEventListener: vi.fn() }
    const request = vi.fn().mockResolvedValue(sentinel)
    ;(navigator as unknown as { wakeLock: unknown }).wakeLock = { request }

    const { result } = await renderWithTag()
    await act(async () => {
      await result.current.startStopwatch()
    })
    expect(request).toHaveBeenCalledWith('screen')

    await act(async () => {
      await result.current.stopStopwatch()
    })
    expect(release).toHaveBeenCalled()

    delete (navigator as unknown as { wakeLock?: unknown }).wakeLock
  })
})
