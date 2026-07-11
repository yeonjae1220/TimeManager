import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// apiClient(axios 인스턴스)를 통째로 mock — 실제 네트워크/axios/authStore 로딩을 차단한다.
vi.mock('@/utils/apiClient', () => ({
  default: { post: vi.fn(), get: vi.fn(), patch: vi.fn() },
}))

import apiClient from '@/utils/apiClient'
import { useTagStore } from './tagStore'
import {
  clearTimerState,
  enqueuePendingTimerOperation,
  peekPendingTimerOperations,
  peekTimerState,
  saveResetTimerMarker,
  saveTimerState,
} from '@/utils/timerPersistence'

const post = apiClient.post as unknown as ReturnType<typeof vi.fn>

function activeTimer(overrides: Record<string, unknown> = {}) {
  return {
    tagId: 1,
    isRunning: true,
    elapsedTime: 5,
    latestStartTime: Date.now() - 5000,
    latestEndTime: null as number | null,
    latestStopTimeMs: null as number | null,
    dailyTotalTime: 0,
    dailyGoalTime: 0,
    ...overrides,
  }
}

const callsTo = (fragment: string) =>
  post.mock.calls.filter((c) => String(c[0]).includes(fragment))
const startCalls = () => callsTo('/timer/start')
const stopCalls = () => callsTo('/timer/stop')
const resetCalls = () => callsTo('/timer/reset')

describe('tagStore.retryPendingTimerOp — 오프라인 큐 재생 정합성', () => {
  beforeEach(() => {
    localStorage.clear()
    post.mockReset()
    post.mockResolvedValue({ data: {} })
  })

  afterEach(() => {
    localStorage.clear()
  })

  // ── 일반 유스케이스 (온라인/오프라인 정상 흐름) ────────────────────────────

  it('[정상·러닝유지] 실행 중 오프라인 start는 재접속 시 재전송되어 running이 유지된다', async () => {
    // 로컬 진실: 여전히 실행 중
    saveTimerState(activeTimer({ isRunning: true }))
    enqueuePendingTimerOperation({ type: 'start', tagId: 1, latestStartTime: Date.now() })

    await useTagStore.getState().retryPendingTimerOp()

    // 실행 중이던 타이머이므로 start를 서버에 반영해야 한다
    expect(startCalls()).toHaveLength(1)
    // 완료 후 큐는 비어 있어야 한다
    expect(peekPendingTimerOperations()).toHaveLength(0)
  })

  it('[정상·세션기록] 오프라인 start→stop 세션은 재접속 시 stop 재전송으로 기록되고 running이 남지 않는다', async () => {
    // 로컬 진실: 정지됨 (stop이 저장했으나 오프라인이라 clear 되지 않음)
    saveTimerState(activeTimer({ isRunning: false, latestStopTimeMs: Date.now() }))
    enqueuePendingTimerOperation({ type: 'start', tagId: 1, latestStartTime: Date.now() - 5000 })
    enqueuePendingTimerOperation({
      type: 'stop',
      tagId: 1,
      elapsedTime: 5,
      latestStartTime: Date.now() - 5000,
      latestEndTime: Date.now(),
    })

    await useTagStore.getState().retryPendingTimerOp()

    // stop이 반영되어 세션이 기록되어야 한다 (stopTimer는 자기완결적)
    expect(stopCalls()).toHaveLength(1)
    // 완료 후 큐는 비어 있어야 한다
    expect(peekPendingTimerOperations()).toHaveLength(0)
  })

  it('[정상·오프라인복원] 네트워크 에러면 큐를 보존하고 재시도 플래그를 해제한다', async () => {
    saveTimerState(activeTimer({ isRunning: false, latestStopTimeMs: Date.now() }))
    enqueuePendingTimerOperation({
      type: 'stop',
      tagId: 1,
      elapsedTime: 5,
      latestStartTime: Date.now() - 5000,
      latestEndTime: Date.now(),
    })
    // 응답 없는 네트워크 에러 (offline)
    post.mockRejectedValueOnce({})

    await useTagStore.getState().retryPendingTimerOp()

    const ops = peekPendingTimerOperations()
    expect(ops).toHaveLength(1) // 유실 없이 보존
    expect(ops[0].retryAttempted).toBe(false) // 다음 기회에 재시도 가능하도록 해제
  })

  // ── 버그 재현 (엣지 케이스) — 수정 전 코드에서는 RED 여야 정상 ──────────────

  it('[버그·유령러닝] stop 성공으로 정지된 뒤 남은 고아 start는 재전송되지 않는다', async () => {
    // stop 성공 → clearTimerState() → 로컬에 활성 타이머 없음
    clearTimerState()
    // start API가 순간 실패로 큐에 남긴 고아 start (stop 성공 경로가 지우지 않음)
    enqueuePendingTimerOperation({ type: 'start', tagId: 1, latestStartTime: Date.now() - 60_000 })

    await useTagStore.getState().retryPendingTimerOp()

    // 서버에 start를 재전송하면 세션 없이 running만 부활한다 → 금지
    expect(startCalls()).toHaveLength(0)
    // 고아는 폐기되어 큐가 비어야 한다
    expect(peekPendingTimerOperations()).toHaveLength(0)
  })

  it('[버그·삭제경로] 고아 start가 큐 앞에 있어도 reset 시 running이 부활하지 않는다', async () => {
    // resetStopwatch가 clearTimerState + reset 마커 후, 고아 start 뒤에 reset을 enqueue한 상황
    clearTimerState()
    saveResetTimerMarker(1)
    enqueuePendingTimerOperation({ type: 'start', tagId: 1, latestStartTime: Date.now() - 60_000 })
    enqueuePendingTimerOperation({ type: 'reset', tagId: 1, elapsedTime: 0 })

    await useTagStore.getState().retryPendingTimerOp()

    // 유령 러닝 방지: start는 나가면 안 된다
    expect(startCalls()).toHaveLength(0)
    // reset은 서버에 반영되어야 한다
    expect(resetCalls()).toHaveLength(1)
    // 완료 후 큐는 비어 있어야 한다
    expect(peekPendingTimerOperations()).toHaveLength(0)
  })
})

describe('추가 엣지케이스 검증 (잠재 버그 스윕)', () => {
  beforeEach(() => {
    localStorage.clear()
    post.mockReset()
    post.mockResolvedValue({ data: {} })
    useTagStore.setState({ isRefreshing: false, _pendingRefreshMemberId: null, _activeMemberId: 7 })
  })
  afterEach(() => localStorage.clear())

  it('[①독성op] 4xx로 실패하는 op가 뒤의 정상 op를 영구히 막지 않는다', async () => {
    // 태그1 stop은 항상 400, 태그2 stop은 정상
    post.mockImplementation((url: string) =>
      String(url).includes('/tags/1/')
        ? Promise.reject({ response: { status: 400 } })
        : Promise.resolve({ data: {} })
    )
    enqueuePendingTimerOperation({
      type: 'stop', tagId: 1, elapsedTime: 5,
      latestStartTime: Date.now() - 5000, latestEndTime: Date.now(),
    })
    enqueuePendingTimerOperation({
      type: 'stop', tagId: 2, elapsedTime: 3,
      latestStartTime: Date.now() - 3000, latestEndTime: Date.now(),
    })

    // 재접속을 여러 번 반복해도
    await useTagStore.getState().retryPendingTimerOp()
    await useTagStore.getState().retryPendingTimerOp()
    await useTagStore.getState().retryPendingTimerOp()

    const tag2Stops = post.mock.calls.filter((c) => String(c[0]).includes('/tags/2/timer/stop'))
    expect(tag2Stops.length).toBeGreaterThanOrEqual(1) // 정상 op는 결국 처리되어야 함
  })

  it('[⑦401] 401(재인증 필요) 실패 op가 큐를 영구히 막지 않는다', async () => {
    post.mockRejectedValue({ response: { status: 401 } })
    enqueuePendingTimerOperation({
      type: 'stop', tagId: 1, elapsedTime: 5,
      latestStartTime: Date.now() - 5000, latestEndTime: Date.now(),
    })

    await useTagStore.getState().retryPendingTimerOp()
    await useTagStore.getState().retryPendingTimerOp()

    // 확정 실패는 무한 정체가 아니라 폐기/격리되어야 함
    expect(peekPendingTimerOperations()).toHaveLength(0)
  })

  it('[⑥동시성] retryPendingTimerOp 동시 호출 시 같은 op가 이중 전송되지 않는다', async () => {
    saveTimerState(activeTimer({ isRunning: false, latestStopTimeMs: Date.now() }))
    enqueuePendingTimerOperation({
      type: 'stop', tagId: 1, elapsedTime: 5,
      latestStartTime: Date.now() - 5000, latestEndTime: Date.now(),
    })

    const store = useTagStore.getState()
    await Promise.all([store.retryPendingTimerOp(), store.retryPendingTimerOp()])

    expect(stopCalls()).toHaveLength(1) // 이중 POST 없음
    expect(peekPendingTimerOperations()).toHaveLength(0)
  })

  it('[②discard] 태그를 삭제(discard)하면 그 태그의 로컬 타이머 상태·대기 op가 정리된다', async () => {
    const patch = apiClient.patch as unknown as ReturnType<typeof vi.fn>
    const getFn = apiClient.get as unknown as ReturnType<typeof vi.fn>
    patch.mockResolvedValue({ data: {} })
    getFn.mockResolvedValue({ data: [] })

    // 삭제 대상 태그가 running 상태로 로컬에 저장 + pending start 잔존
    saveTimerState(activeTimer({ tagId: 1, isRunning: true }))
    enqueuePendingTimerOperation({ type: 'start', tagId: 1, latestStartTime: Date.now() })

    await useTagStore.getState().discardTag(1, 99)

    // 삭제된 태그의 로컬 잔재가 남으면 유령 러닝/큐 정체(404 poison)를 유발한다
    expect(peekTimerState()).toBeNull()
    expect(peekPendingTimerOperations().filter((o) => o.tagId === 1)).toHaveLength(0)
  })
})

// ── 기기 간 캐시 정합성 (applyLocalTimerOverrides) ─────────────────────────
//
// 태그 목록 화면(tagStore.tagTree)은 useTagTimer(today 화면)와 별개로 자체적으로
// "이 기기의 로컬 타이머 상태 vs 서버 응답"을 병합한다(applyLocalTimerOverrides).
// 이 로직은 지금까지 테스트가 전혀 없었다 — 다른 기기가 먼저 조작한 뒤 이 기기가
// (자신의 stale 로컬 상태를 들고) 새로고침하면 어느 쪽이 화면에 표시되는지 검증한다.
describe('tagStore._doRefreshTags — 기기 간 캐시 정합성 (applyLocalTimerOverrides)', () => {
  const getFn = () => apiClient.get as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    getFn().mockReset()
    useTagStore.setState({
      isRefreshing: false,
      _pendingRefreshMemberId: null,
      _activeMemberId: 7,
      tagTree: [],
      lastFetchedAt: null,
    })
  })

  afterEach(() => localStorage.clear())

  function serverTree(leafOverrides: Record<string, unknown> = {}) {
    return [
      {
        id: 1, name: 'root', type: 'ROOT', state: false, elapsedTime: 0,
        latestStartTimeMs: null, latestStopTimeMs: Date.now() - 100_000,
        children: [
          {
            id: 2, name: 'Leaf', type: 'LEAF', state: false, elapsedTime: 0,
            latestStartTimeMs: null, latestStopTimeMs: Date.now() - 100_000,
            children: [],
            ...leafOverrides,
          },
        ],
      },
    ]
  }

  it('[다른기기 최신] 이 기기의 로컬 러닝 상태가 stale이면, 다른 기기가 정지시킨 최신 서버 상태를 따른다', async () => {
    // 이 기기(B)는 예전에 태그2를 시작해둔 로컬 캐시를 여전히 들고 있다 (동기화 안 됨)
    saveTimerState({
      tagId: 2, isRunning: true, elapsedTime: 10,
      latestStartTime: Date.now() - 300_000, latestEndTime: null, latestStopTimeMs: null,
      dailyTotalTime: 0, dailyGoalTime: 0,
    })
    // 다른 기기(A)가 그 이후 실제로 정지시켜 서버가 더 최신
    getFn().mockResolvedValue({ data: serverTree({ latestStopTimeMs: Date.now() }) })

    await useTagStore.getState()._doRefreshTags(7)

    const leaf = useTagStore.getState().findById(2)
    expect(leaf?.state).toBe(false)
  })

  it('[이 기기 최신] 이 기기가 방금 시작해 로컬이 서버 응답보다 최신이면, 새로고침해도 로컬 running을 유지한다', async () => {
    saveTimerState({
      tagId: 2, isRunning: true, elapsedTime: 0,
      latestStartTime: Date.now(), latestEndTime: null, latestStopTimeMs: null,
      dailyTotalTime: 0, dailyGoalTime: 0,
    })
    // 서버 응답이 아직 이 조작을 반영하기 전(지연 응답)이라고 가정
    getFn().mockResolvedValue({ data: serverTree({ latestStopTimeMs: Date.now() - 200_000 }) })

    await useTagStore.getState()._doRefreshTags(7)

    const leaf = useTagStore.getState().findById(2)
    expect(leaf?.state).toBe(true)
    expect(leaf?.elapsedTime).toBe(0)
  })

  it('[리셋마커 우선] 이 기기에서 리셋한 직후 새로고침해도, 서버가 아직 그 이전 값이면 정지+0으로 표시한다', async () => {
    saveResetTimerMarker(2)
    // 서버 응답은 리셋 이전의 오래된 running 상태(전파 지연)
    getFn().mockResolvedValue({
      data: serverTree({ state: true, elapsedTime: 999, latestStartTimeMs: Date.now() - 500_000 }),
    })

    await useTagStore.getState()._doRefreshTags(7)

    const leaf = useTagStore.getState().findById(2)
    expect(leaf?.state).toBe(false)
    expect(leaf?.elapsedTime).toBe(0)
  })

  it('[교차기기·리셋 무시] 다른 기기가 이후 다시 시작시켰다면, 이 기기의 리셋 마커보다 서버를 따른다', async () => {
    saveResetTimerMarker(2)
    // 다른 기기(A)가 리셋 마커 이후 다시 시작시켜 서버가 더 최신
    getFn().mockResolvedValue({
      data: serverTree({ state: true, elapsedTime: 3, latestStartTimeMs: Date.now() + 5_000 }),
    })

    await useTagStore.getState()._doRefreshTags(7)

    const leaf = useTagStore.getState().findById(2)
    expect(leaf?.state).toBe(true)
  })
})
