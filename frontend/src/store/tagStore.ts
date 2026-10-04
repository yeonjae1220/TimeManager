'use client'

import { create } from 'zustand'
import { get as idbGet, set as idbSet } from 'idb-keyval'
import apiClient from '@/utils/apiClient'
import {
  clearRetryAttempted,
  clearTimerState,
  forgetTagTimerLocally,
  markRetryAttempted,
  peekPendingTimerOperation,
  peekResetTimerMarkers,
  peekTimerState,
  removePendingTimerOperation,
  serverTimerChangedAt,
  shouldApplyResetTimerMarker,
} from '@/utils/timerPersistence'
import { sessionFromTimerState, syncNativeRunningSession } from '@/native/runningSession'
import { isOnline } from '@/utils/connectivity'

export interface Tag {
  id: number
  name: string
  type: 'ROOT' | 'CATEGORY' | 'LEAF' | 'DISCARDED'
  state: boolean
  elapsedTime: number
  dailyTotalTime?: number
  dailyGoalTime?: number
  tagTotalTime?: number
  totalTime?: number
  latestStartTimeMs?: number | null
  latestStopTimeMs: number | null
  memberId?: number
  children: Tag[]
}

const cacheKey = (memberId: number) => `tags-${memberId}`

/**
 * IndexedDB 캐시 읽기의 상한. iOS WebKit 은 앱이 백그라운드에서 돌아온 뒤 IndexedDB 요청이
 * 끝나지 않는(resolve·reject 둘 다 없는) 경우가 있다 — 상한이 없으면 그 뒤의 서버 조회까지
 * 영영 시작되지 않는다. 캐시는 서버 값을 기다리는 동안의 보조이므로 넘기면 캐시 없음으로 본다.
 */
export const IDB_TIMEOUT_MS = 2_000

async function readTagCache(memberId: number): Promise<Tag[] | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const giveUp = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => {
      console.warn('IndexedDB cache read timed out')
      resolve(undefined)
    }, IDB_TIMEOUT_MS)
  })
  try {
    return await Promise.race([idbGet(cacheKey(memberId)) as Promise<Tag[] | undefined>, giveUp])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 캐시 저장은 기다리지 않는다. 서버 값은 이미 화면에 반영됐고 저장은 다음 콜드 스타트용이다 —
 * 기다리면 저장이 끝나지 않을 때(위 iOS 문제) isRefreshing 이 영영 풀리지 않아 "동기화 중"이
 * 고착되고, 그 뒤의 새로고침은 전부 대기열에만 쌓인다.
 */
function writeTagCache(memberId: number, tagTree: Tag[], label: string): void {
  idbSet(cacheKey(memberId), tagTree).catch((e) => console.warn(`${label}:`, e))
}

let _refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null
let _retryPromise: Promise<void> | null = null

function findTagById(tagTree: Tag[], id: number): Tag | null {
  for (const node of tagTree) {
    if (node.id === id) return node
    if (node.children?.length) {
      const found = findTagById(node.children, id)
      if (found) return found
    }
  }
  return null
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

function applyLocalTimerOverrides(tagTree: Tag[]): Tag[] {
  const localTimer = peekTimerState()
  const resetMarkers = peekResetTimerMarkers()
  if (!localTimer && resetMarkers.length === 0) return tagTree

  const next = deepClone(tagTree)

  if (localTimer) {
    const target = findTagById(next, localTimer.tagId)
    if (target) {
      const serverChangedAt = serverTimerChangedAt(target.latestStartTimeMs, target.latestStopTimeMs)
      if (localTimer.savedAt > serverChangedAt) {
        target.state = localTimer.isRunning
        target.elapsedTime = localTimer.elapsedTime
      }
    }
  }

  for (const marker of resetMarkers) {
    const target = findTagById(next, marker.tagId)
    if (
      target &&
      shouldApplyResetTimerMarker(marker, target.latestStartTimeMs, target.latestStopTimeMs)
    ) {
      target.state = false
      target.elapsedTime = 0
    }
  }

  return next
}

const RECENT_TAGS_KEY = 'recentTagIds'
const MAX_RECENT_TAGS = 16

function loadRecentTagIds(): number[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENT_TAGS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRecentTagIds(ids: number[]) {
  try {
    localStorage.setItem(RECENT_TAGS_KEY, JSON.stringify(ids))
  } catch { /* ignore */ }
}

interface TagStoreState {
  tagTree: Tag[]
  lastFetchedAt: number | null
  isRefreshing: boolean
  fetchError: boolean
  _activeMemberId: number | null
  _pendingRefreshMemberId: number | null
  recentTagIds: number[]

  findById: (id: number) => Tag | null
  addRecentTag: (tagId: number) => void

  createTag: (name: string, parentTagId: number) => Promise<number>
  renameTag: (tagId: number, name: string) => Promise<void>
  moveTag: (tagId: number, newParentTagId: number) => Promise<void>
  reorderTags: (parentTagId: number, orderedTagIds: number[]) => Promise<void>
  discardTag: (tagId: number, discardedParentId: number) => Promise<void>

  loadTagsFromCache: (memberId: number) => Promise<void>
  loadTags: (memberId: number) => Promise<void>
  refreshTags: (memberId: number) => void
  _doRefreshTags: (memberId: number) => Promise<void>
  setTagState: (tagId: number, state: boolean) => void
  retryPendingTimerOp: () => Promise<void>
  _retryPendingIfEligible: () => void
  getRetryPromise: () => Promise<void> | null
  handleOnline: () => Promise<void>
  clearCache: () => Promise<void>
}

export const useTagStore = create<TagStoreState>()((set, get) => ({
  tagTree: [],
  lastFetchedAt: null,
  isRefreshing: false,
  fetchError: false,
  _activeMemberId: null,
  _pendingRefreshMemberId: null,
  recentTagIds: loadRecentTagIds(),

  findById: (id) => findTagById(get().tagTree, id),

  addRecentTag(tagId) {
    const prev = get().recentTagIds.filter((id) => id !== tagId)
    const next = [tagId, ...prev].slice(0, MAX_RECENT_TAGS)
    set({ recentTagIds: next })
    saveRecentTagIds(next)
  },

  async createTag(name, parentTagId) {
    const res = await apiClient.post<number>('/api/v1/tags', { tagName: name, parentTagId })
    const mid = get()._activeMemberId
    if (mid) await get()._doRefreshTags(mid)
    return res.data
  },

  async renameTag(tagId, name) {
    await apiClient.patch(`/api/v1/tags/${tagId}/name`, { name })
    const mid = get()._activeMemberId
    if (mid) await get()._doRefreshTags(mid)
  },

  async moveTag(tagId, newParentTagId) {
    await apiClient.patch(`/api/v1/tags/${tagId}`, { newParentTagId })
    const mid = get()._activeMemberId
    if (mid) await get()._doRefreshTags(mid)
  },

  async reorderTags(parentTagId, orderedTagIds) {
    await apiClient.patch('/api/v1/tags/reorder', { parentTagId, orderedTagIds })
    const mid = get()._activeMemberId
    if (mid) await get()._doRefreshTags(mid)
  },

  async discardTag(tagId, discardedParentId) {
    await apiClient.patch(`/api/v1/tags/${tagId}`, { newParentTagId: discardedParentId })
    // 삭제된 태그의 로컬 타이머 잔재(타이머 상태·대기 op·리셋 마커)를 정리한다.
    // 남겨두면 유령 러닝이나 사라진 태그 대상 pending op의 404로 큐가 막힌다.
    forgetTagTimerLocally(tagId)
    const mid = get()._activeMemberId
    if (mid) await get()._doRefreshTags(mid)
  },

  async loadTagsFromCache(memberId) {
    set({ fetchError: false, _activeMemberId: memberId })

    // 대기 중인 op 재전송은 태그 신선도와 무관하게 먼저 시도한다.
    // 아래 신선도 조기 반환 뒤에 두면, 재로그인이 직전 태그 조회로부터 30초 안에
    // 일어났을 때 오프라인에서 쌓인 사용자 작업이 재전송되지 않고 묻힌다.
    get()._retryPendingIfEligible()

    const FRESH_THRESHOLD_MS = 30_000
    const state = get()
    if (
      state.isRefreshing ||
      (state.tagTree.length > 0 && state.lastFetchedAt && Date.now() - state.lastFetchedAt < FRESH_THRESHOLD_MS)
    ) {
      return
    }

    try {
      const cached = await readTagCache(memberId)
      if (cached) set({ tagTree: cached })
    } catch (e) {
      console.warn('IndexedDB cache read failed:', e)
    }

    const tagTree = applyLocalTimerOverrides(get().tagTree)
    set({ tagTree })

  },

  /** 대기 op가 있고 지금 보낼 수 있으면 재전송을 시작한다(중복 호출은 in-flight 프라미스가 흡수). */
  _retryPendingIfEligible() {
    const pending = peekPendingTimerOperation()
    // navigator.onLine 은 네이티브 WebView 에서 항상 true 라 게이트 역할을 못 한다.
    // 관찰된 연결 상태로 판단한다(utils/connectivity.ts).
    if (!pending || !isOnline() || pending.retryAttempted) return
    get().retryPendingTimerOp().then(() => {
      const mid = get()._activeMemberId
      if (mid) get().refreshTags(mid)
    })
  },

  async loadTags(memberId) {
    await get().loadTagsFromCache(memberId)
    await get()._doRefreshTags(memberId)
  },

  refreshTags(memberId) {
    if (get().isRefreshing) {
      set({ _pendingRefreshMemberId: memberId })
      return
    }
    if (_refreshDebounceTimer) clearTimeout(_refreshDebounceTimer)
    _refreshDebounceTimer = setTimeout(() => {
      _refreshDebounceTimer = null
      get()._doRefreshTags(memberId)
    }, 300)
  },

  async _doRefreshTags(memberId) {
    if (get().isRefreshing) {
      set({ _pendingRefreshMemberId: memberId })
      return
    }
    set({ _pendingRefreshMemberId: null, isRefreshing: true })

    try {
      const response = await apiClient.get<Tag[]>(`/api/v1/tags?memberId=${memberId}`)
      let tagTree = response.data
      set({ lastFetchedAt: Date.now(), fetchError: false })

      tagTree = applyLocalTimerOverrides(tagTree)

      set({ tagTree })
      writeTagCache(memberId, tagTree, 'IndexedDB cache save failed')
    } catch (error) {
      console.error('Tag fetch failed:', error)
      if (!selectHasCachedData(get())) set({ fetchError: true })
      if (get().tagTree.length === 0) {
        try {
          const cached = await readTagCache(memberId)
          if (cached) set({ tagTree: cached })
        } catch (e) {
          console.warn('IndexedDB recovery failed:', e)
        }
      }
    } finally {
      set({ isRefreshing: false })
      const pending = get()._pendingRefreshMemberId
      if (pending) {
        set({ _pendingRefreshMemberId: null })
        get()._doRefreshTags(pending)
      }
    }
  },

  setTagState(tagId, state) {
    const tagTree = deepClone(get().tagTree)
    const target = findTagById(tagTree, tagId)
    if (target) {
      target.state = state
      set({ tagTree, lastFetchedAt: Date.now() })
      const activeMemberId = get()._activeMemberId
      if (activeMemberId) writeTagCache(activeMemberId, tagTree, 'IndexedDB optimistic update failed')
    }
  },

  async retryPendingTimerOp() {
    const inner = (async () => {
      while (true) {
        const pending = peekPendingTimerOperation()
        if (!pending || pending.retryAttempted) return

        // 고아 start 방어: 로컬 타이머가 더 이상 이 태그를 running으로 보지 않으면
        // (stop/reset/clear 이후 큐에 남은) start는 폐기한다. startTimer는 세션 없이
        // running 상태만 세팅하므로, 재전송하면 세션 없는 "유령 러닝"이 부활한다.
        if (pending.type === 'start') {
          const active = peekTimerState()
          if (!active || active.tagId !== pending.tagId || !active.isRunning) {
            removePendingTimerOperation(pending.id)
            continue
          }
        }

        markRetryAttempted(pending.id)

        try {
          if (pending.type === 'stop') {
            await apiClient.post(
              `/api/v1/tags/${pending.tagId}/timer/stop`,
              {
                elapsedTime: pending.elapsedTime,
                timestamps: {
                  startTime: new Date(pending.latestStartTime).toISOString(),
                  endTime: new Date(pending.latestEndTime).toISOString(),
                },
              },
              { headers: { 'Content-Type': 'application/json' } }
            )
            const activeTimer = peekTimerState()
            if (activeTimer?.tagId === pending.tagId && !activeTimer.isRunning) {
              clearTimerState()
            }
          } else if (pending.type === 'start') {
            await apiClient.post(
              `/api/v1/tags/${pending.tagId}/timer/start`,
              { startTime: new Date(pending.latestStartTime).toISOString() },
              { headers: { 'Content-Type': 'application/json' } }
            )
          } else {
            await apiClient.post(
              `/api/v1/tags/${pending.tagId}/timer/reset`,
              { elapsedTime: pending.elapsedTime },
              { headers: { 'Content-Type': 'application/json' } }
            )
          }
          removePendingTimerOperation(pending.id)
        } catch (e: unknown) {
          const status = (e as { response?: { status?: number } }).response?.status

          // 401은 "이 op가 틀렸다"가 아니라 "지금 자격이 없다" — 오프라인 중 세션이 만료된
          // 전형적인 경우다. 폐기하면 사용자가 오프라인에서 한 작업이 조용히 사라지므로
          // 큐에 보존하고 재생만 중단한다. 어차피 뒤의 op도 같은 이유로 401이라 계속해봐야
          // 소용없다. 재로그인 후 재전송이 트리거되면 그대로 처리된다.
          if (status === 401) {
            clearRetryAttempted(pending.id)
            return
          }

          const isClientError = typeof status === 'number' && status >= 400 && status < 500
          if (isClientError) {
            // 401 외 4xx는 이 op가 앞으로도 성공할 수 없는 확정 실패(잘못된 요청·삭제된 태그,
            // 서버가 거부한 stale 한 정지 등). 큐 헤드에 남겨두면 뒤의 정상 op까지 영구히
            // 막으므로 폐기하고 다음 op로 진행한다.
            //
            // 다만 폐기는 사용자가 실제로 누른 조작이 사라지는 자리다. 흔적을 안 남기면
            // "왜 기록이 없지"를 추적할 수단이 0이 되므로 무엇을 왜 버렸는지 반드시 남긴다.
            console.warn(
              `Discarding pending timer op (type=${pending.type}, tagId=${pending.tagId}, status=${status}) — 서버가 확정 거부했습니다`
            )
            removePendingTimerOperation(pending.id)
            continue
          }
          // 네트워크/5xx(일시적)는 재시도 플래그를 풀어 다음 기회에 재시도한다.
          clearRetryAttempted(pending.id)
          return
        }
      }
    })()

    _retryPromise = inner
    try {
      await inner
    } finally {
      _retryPromise = null
      // 큐 재생이 끝나면 로컬 권위 상태 기준으로 네이티브 표면을 한 번 재수렴시킨다.
      // 고아 start 폐기·401 보존·4xx 폐기 등 재생 경로가 여럿이라 경로마다 알림을
      // 취소하면 진실의 소스가 둘이 되어 오히려 드리프트한다. 결과만 보고 수렴시킨다.
      const active = peekTimerState()
      const name = active ? findTagById(get().tagTree, active.tagId)?.name : undefined
      void syncNativeRunningSession(sessionFromTimerState(active, name))
    }
  },

  getRetryPromise: () => _retryPromise,

  handleOnline() {
    const activeMemberId = get()._activeMemberId
    if (!activeMemberId) return Promise.resolve()
    // 재전송 완료 후 즉시 1회 갱신 — 매직 딜레이 없이 재전송 결과를 그대로 반영.
    // Promise를 반환해야 호출부(TodayView)가 재전송이 끝난 뒤에 "오늘 기록시간"을
    // 조회할 수 있다 — 안 그러면 큐에 남은 오프라인 stop이 아직 서버에 반영되기 전에
    // summary를 읽어, 그 세션분이 통째로 빠진 값을 화면에 영구히 남긴다(재조회 전까지).
    return get().retryPendingTimerOp().then(() => {
      const mid = get()._activeMemberId
      if (mid) get().refreshTags(mid)
    })
  },

  async clearCache() {
    set({ tagTree: [], lastFetchedAt: null, fetchError: false })
  },
}))

// Selectors — use these instead of inline getters to ensure reactivity
//
// ⚠️ 셀렉터는 같은 상태에 대해 항상 같은 참조를 돌려줘야 한다. zustand v5 는
// 셀렉터를 useSyncExternalStore 의 getSnapshot 으로 그대로 쓰므로, 매 호출 새
// 배열·객체를 만들면 React 가 끝없이 재렌더해 Maximum update depth exceeded(#185)로
// 화면 전체가 에러 바운더리로 떨어진다(태그 조회 실패 + 캐시 없음 = ROOT 없는 트리).
const EMPTY_TAG_LIST: readonly Tag[] = Object.freeze([])

export const selectRootTag = (s: TagStoreState) =>
  s.tagTree.find((t) => t.type === 'ROOT') ?? null

export const selectTagList = (s: TagStoreState): readonly Tag[] =>
  selectRootTag(s)?.children ?? EMPTY_TAG_LIST

export const selectHasCachedData = (s: TagStoreState) =>
  s.tagTree.length > 0
