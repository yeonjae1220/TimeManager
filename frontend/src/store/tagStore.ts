'use client'

import { create } from 'zustand'
import { get as idbGet, set as idbSet } from 'idb-keyval'
import apiClient from '@/utils/apiClient'
import {
  clearRetryAttempted,
  clearTimerState,
  markRetryAttempted,
  peekPendingTimerOperation,
  peekResetTimerMarker,
  peekTimerState,
  removePendingTimerOperation,
  shouldApplyResetTimerMarker,
} from '@/utils/timerPersistence'

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
  const resetMarker = peekResetTimerMarker()
  if (!localTimer && !resetMarker) return tagTree

  const next = deepClone(tagTree)

  if (localTimer) {
    const target = findTagById(next, localTimer.tagId)
    if (target) {
      const serverChangedAt = Math.max(target.latestStartTimeMs || 0, target.latestStopTimeMs || 0)
      if (localTimer.savedAt > serverChangedAt) {
        target.state = localTimer.isRunning
        target.elapsedTime = localTimer.elapsedTime
      }
    }
  }

  if (resetMarker) {
    const target = findTagById(next, resetMarker.tagId)
    if (
      target &&
      shouldApplyResetTimerMarker(resetMarker, target.latestStartTimeMs, target.latestStopTimeMs)
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

  createTag: (name: string, parentTagId: number) => Promise<void>
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
  recentTagIds: loadRecentTagIds(),

  findById: (id) => findTagById(get().tagTree, id),

  addRecentTag(tagId) {
    const prev = get().recentTagIds.filter((id) => id !== tagId)
    const next = [tagId, ...prev].slice(0, MAX_RECENT_TAGS)
    set({ recentTagIds: next })
    saveRecentTagIds(next)
  },

  async createTag(name, parentTagId) {
    await apiClient.post('/api/v1/tags', { tagName: name, parentTagId })
    const mid = get()._activeMemberId
    if (mid) await get()._doRefreshTags(mid)
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
    const mid = get()._activeMemberId
    if (mid) await get()._doRefreshTags(mid)
  },

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

    const tagTree = applyLocalTimerOverrides(get().tagTree)
    set({ tagTree })

    const pendingTimerOperation = peekPendingTimerOperation()
    if (pendingTimerOperation && navigator.onLine && !pendingTimerOperation.retryAttempted) {
      get().retryPendingTimerOp().then(() => {
        const mid = get()._activeMemberId
        if (mid) get().refreshTags(mid)
      })
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

      tagTree = applyLocalTimerOverrides(tagTree)

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
      while (true) {
        const pending = peekPendingTimerOperation()
        if (!pending || pending.retryAttempted) return

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
          const isNetworkError = !(e as { response?: unknown }).response
          if (isNetworkError) clearRetryAttempted(pending.id)
          return
        }
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
