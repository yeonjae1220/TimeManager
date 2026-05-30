'use client'

import { create } from 'zustand'
import { get as idbGet, set as idbSet } from 'idb-keyval'
import apiClient from '@/utils/apiClient'
import { peekTimerState, clearTimerState, markRetryAttempted, clearRetryAttempted } from '@/utils/timerPersistence'

export interface Tag {
  id: number
  name: string
  type: 'ROOT' | 'CATEGORY' | 'LEAF'
  state: boolean
  elapsedTime: number
  dailyTotalTime?: number
  dailyGoalTime?: number
  tagTotalTime?: number
  totalTime?: number
  latestStartTimeMs?: number | null
  latestStopTimeMs: number | null
  children: Tag[]
}

const cacheKey = (memberId: number) => `tags-${memberId}`

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

interface TagStoreState {
  tagTree: Tag[]
  lastFetchedAt: number | null
  isRefreshing: boolean
  fetchError: boolean
  _activeMemberId: number | null
  _pendingRefreshMemberId: number | null

  findById: (id: number) => Tag | null

  loadTagsFromCache: (memberId: number) => Promise<void>
  loadTags: (memberId: number) => Promise<void>
  refreshTags: (memberId: number) => void
  _doRefreshTags: (memberId: number) => Promise<void>
  setTagState: (tagId: number, state: boolean) => void
  retryPendingTimerOp: () => Promise<void>
  getRetryPromise: () => Promise<void> | null
  handleOnline: () => void
  clearCache: () => Promise<void>
}

export const useTagStore = create<TagStoreState>()((set, get) => ({
  tagTree: [],
  lastFetchedAt: null,
  isRefreshing: false,
  fetchError: false,
  _activeMemberId: null,
  _pendingRefreshMemberId: null,

  findById: (id) => findTagById(get().tagTree, id),

  async loadTagsFromCache(memberId) {
    set({ fetchError: false, _activeMemberId: memberId })

    const FRESH_THRESHOLD_MS = 30_000
    const state = get()
    if (
      state.isRefreshing ||
      (state.tagTree.length > 0 && state.lastFetchedAt && Date.now() - state.lastFetchedAt < FRESH_THRESHOLD_MS)
    ) {
      return
    }

    try {
      const cached = await idbGet(cacheKey(memberId)) as Tag[] | undefined
      if (cached) set({ tagTree: cached })
    } catch (e) {
      console.warn('IndexedDB cache read failed:', e)
    }

    const localTimer = peekTimerState()
    if (localTimer) {
      const tagTree = deepClone(get().tagTree)
      const target = findTagById(tagTree, localTimer.tagId)
      if (target) {
        const serverStopTimeMs = target.latestStopTimeMs || 0
        if (localTimer.savedAt > serverStopTimeMs) {
          target.state = localTimer.isRunning
        }
      }
      set({ tagTree })

      if (navigator.onLine && !localTimer.retryAttempted) {
        get().retryPendingTimerOp().then(() => {
          const mid = get()._activeMemberId
          if (mid) get().refreshTags(mid)
        })
      }
    }
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

      const localTimer = peekTimerState()
      if (localTimer) {
        tagTree = deepClone(tagTree)
        const target = findTagById(tagTree, localTimer.tagId)
        if (target) {
          const serverStopTimeMs = target.latestStopTimeMs || 0
          if (localTimer.savedAt > serverStopTimeMs) {
            target.state = localTimer.isRunning
          }
        }
      }

      set({ tagTree })

      try {
        await idbSet(cacheKey(memberId), tagTree)
      } catch (e) {
        console.warn('IndexedDB cache save failed:', e)
      }
    } catch (error) {
      console.error('Tag fetch failed:', error)
      if (!selectHasCachedData(get())) set({ fetchError: true })
      if (get().tagTree.length === 0) {
        try {
          const cached = await idbGet(cacheKey(memberId)) as Tag[] | undefined
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
      if (activeMemberId) {
        idbSet(cacheKey(activeMemberId), tagTree).catch((e) =>
          console.warn('IndexedDB optimistic update failed:', e)
        )
      }
    }
  },

  async retryPendingTimerOp() {
    const inner = (async () => {
      const saved = peekTimerState()
      if (!saved || saved.retryAttempted) return

      markRetryAttempted()

      try {
        if (!saved.isRunning && saved.latestEndTime) {
          await apiClient.post(
            `/api/v1/tags/${saved.tagId}/timer/stop`,
            {
              elapsedTime: saved.elapsedTime,
              timestamps: {
                startTime: new Date(saved.latestStartTime!).toISOString(),
                endTime: new Date(saved.latestEndTime).toISOString(),
              },
            },
            { headers: { 'Content-Type': 'application/json' } }
          )
          clearTimerState()
        } else if (saved.isRunning && saved.latestStartTime) {
          await apiClient.post(
            `/api/v1/tags/${saved.tagId}/timer/start`,
            { startTime: new Date(saved.latestStartTime).toISOString() },
            { headers: { 'Content-Type': 'application/json' } }
          )
          clearTimerState()
        }
      } catch (e: unknown) {
        const isNetworkError = !(e as { response?: unknown }).response
        if (isNetworkError) clearRetryAttempted()
      }
    })()

    _retryPromise = inner
    try {
      await inner
    } finally {
      _retryPromise = null
    }
  },

  getRetryPromise: () => _retryPromise,

  handleOnline() {
    const activeMemberId = get()._activeMemberId
    if (!activeMemberId) return
    // 재전송 완료 후 즉시 1회 갱신 — 매직 딜레이 없이 재전송 결과를 그대로 반영
    get().retryPendingTimerOp().then(() => {
      const mid = get()._activeMemberId
      if (mid) get().refreshTags(mid)
    })
  },

  async clearCache() {
    set({ tagTree: [], lastFetchedAt: null, fetchError: false })
  },
}))

// Selectors — use these instead of inline getters to ensure reactivity
export const selectRootTag = (s: TagStoreState) =>
  s.tagTree.find((t) => t.type === 'ROOT') ?? null

export const selectTagList = (s: TagStoreState) =>
  selectRootTag(s)?.children ?? []

export const selectHasCachedData = (s: TagStoreState) =>
  s.tagTree.length > 0
