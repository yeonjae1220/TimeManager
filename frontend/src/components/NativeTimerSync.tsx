'use client'

import { useEffect } from 'react'
import apiClient from '@/utils/apiClient'
import { useRunningTimerStore } from '@/store/runningTimerStore'
import { useTagStore } from '@/store/tagStore'
import { isOnline, subscribeConnectivity } from '@/utils/connectivity'
import { peekTimerState } from '@/utils/timerPersistence'
import { computeStopwatchState } from '@/utils/stopwatchState'
import { syncNativeRunningSession, type NativeRunningSession } from '@/native/runningSession'
import type { Tag } from '@/store/tagStore'

const REFRESH_MS = 30_000
const THROTTLE_MS = 5_000

/** The server reconciles running timers before returning the tree. Discarded subtrees
 * never own a native surface. Local offline operations use the same rules as Today. */
function runningSession(tags: Tag[]): NativeRunningSession | null {
  let latest: NativeRunningSession | null = null
  const visit = (nodes: Tag[]) => {
    for (const tag of nodes) {
      if (tag.type === 'DISCARDED') continue
      const sw = computeStopwatchState(tag.id, tag)
      if (sw.isRunning && (!latest || sw.latestStartTime > latest.startedAtMs)) {
        latest = {
          tagId: tag.id, tagName: tag.name, startedAtMs: sw.latestStartTime,
          baseElapsedSec: sw.elapsedTime, dailyBaseSec: sw.dailyTotalTime,
          dailyGoalSec: sw.dailyGoalTime,
        }
      }
      visit(tag.children ?? [])
    }
  }
  visit(tags)
  return latest
}

/** One foreground reconciler feeds the shared mini timer and native surfaces.
 * Suspended iOS apps still require APNs for remote updates. */
export function NativeTimerSync({ memberId }: { memberId: number }) {
  useEffect(() => {
    const runtime = useRunningTimerStore.getState()
    if (runtime.memberId !== memberId) useRunningTimerStore.setState({ memberId, session: null, busy: false, revision: runtime.revision + 1 })
    const saved = peekTimerState()
    if (saved?.isRunning && saved.latestStartTime && !isOnline()) {
      void syncNativeRunningSession({ tagId: saved.tagId, tagName: useTagStore.getState().findById(saved.tagId)?.name ?? '', startedAtMs: saved.latestStartTime, baseElapsedSec: saved.elapsedTime, dailyBaseSec: saved.dailyTotalTime, dailyGoalSec: saved.dailyGoalTime })
    }

    let disposed = false
    let inFlight = false
    let lastAttempt = -Infinity
    const refresh = async () => {
      if (disposed || inFlight || !isOnline() || document.visibilityState !== 'visible') return
      if (Date.now() - lastAttempt < THROTTLE_MS) return
      lastAttempt = Date.now()
      inFlight = true
      const revision = useRunningTimerStore.getState().revision
      if (useRunningTimerStore.getState().busy) { inFlight = false; return }
      const localBefore = JSON.stringify(peekTimerState())
      try {
        const { data } = await apiClient.get<Tag[]>(`/api/v1/tags?memberId=${memberId}`)
        // A navigation, account change or timer action can invalidate an outstanding read.
        if (disposed || useRunningTimerStore.getState().busy || revision !== useRunningTimerStore.getState().revision || localBefore !== JSON.stringify(peekTimerState())) return
        useTagStore.setState({ tagTree: data, lastFetchedAt: Date.now() })
        await syncNativeRunningSession(runningSession(data))
      } catch {
        // An unavailable server is not evidence that the timer stopped. Retry on return.
        lastAttempt = -Infinity
      } finally {
        inFlight = false
      }
    }
    const onVisible = () => { void refresh() }
    const unsubscribe = subscribeConnectivity((online) => { if (online) void refresh() })
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(onVisible, REFRESH_MS)
    void refresh()
    return () => {
      disposed = true
      unsubscribe()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [memberId])
  return null
}
