import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// iOS WebKit 은 앱이 백그라운드에서 돌아온 뒤 IndexedDB 요청이 끝나지 않는(resolve·reject
// 둘 다 없는) 경우가 있다. 그 상태를 그대로 재현한다.
vi.mock('idb-keyval', () => ({
  get: vi.fn(() => new Promise(() => {})),
  set: vi.fn(() => new Promise(() => {})),
}))
vi.mock('@/utils/apiClient', () => ({
  default: { post: vi.fn(), get: vi.fn(), patch: vi.fn() },
}))

import apiClient from '@/utils/apiClient'
import { IDB_TIMEOUT_MS, useTagStore } from './tagStore'

const getFn = apiClient.get as unknown as ReturnType<typeof vi.fn>

const SERVER_TREE = [
  { id: 1, name: 'root', type: 'ROOT', state: false, elapsedTime: 0, latestStopTimeMs: null, children: [] },
]

describe('tagStore — IndexedDB 가 응답하지 않아도 동기화가 멈추지 않는다', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    getFn.mockReset()
    getFn.mockResolvedValue({ data: SERVER_TREE })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    useTagStore.setState({
      isRefreshing: false,
      _pendingRefreshMemberId: null,
      _activeMemberId: 7,
      tagTree: [],
      lastFetchedAt: null,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('[회귀] 캐시 저장이 끝나지 않아도 서버 값을 반영하면 isRefreshing 이 풀린다', async () => {
    await useTagStore.getState()._doRefreshTags(7)

    const state = useTagStore.getState()
    expect(state.tagTree).toEqual(SERVER_TREE)
    expect(state.isRefreshing).toBe(false)
  })

  it('[회귀] 그 뒤의 새로고침 요청도 실제로 서버에 나간다(대기열에 묻히지 않는다)', async () => {
    await useTagStore.getState()._doRefreshTags(7)
    await useTagStore.getState()._doRefreshTags(7)

    expect(getFn).toHaveBeenCalledTimes(2)
  })

  it('[회귀] 캐시 읽기가 끝나지 않아도 상한 뒤 서버 조회로 넘어간다', async () => {
    const loading = useTagStore.getState().loadTags(7)
    await vi.advanceTimersByTimeAsync(IDB_TIMEOUT_MS)
    await loading

    expect(getFn).toHaveBeenCalledWith('/api/v1/tags?memberId=7')
    expect(useTagStore.getState().tagTree).toEqual(SERVER_TREE)
  })
})
