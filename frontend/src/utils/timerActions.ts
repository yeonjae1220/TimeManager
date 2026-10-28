'use client'
import apiClient from './apiClient'
import { recordsChanged } from './recordMutations'
import { useAuthStore } from '@/store/authStore'
import { useTagStore, type Tag } from '@/store/tagStore'
import { useRunningTimerStore } from '@/store/runningTimerStore'
import { sessionFromTimerState, syncNativeRunningSession, type NativeRunningSession } from '@/native/runningSession'
import { clearTimerState, enqueuePendingTimerOperation, peekPendingTimerOperations, peekTimerState, saveTimerState, serverTimerChangedAt } from './timerPersistence'
import type { StopwatchState } from './stopwatchState'

function patchTag(id: number, patch: Partial<Tag>) {
  const walk = (nodes: Tag[]): Tag[] => nodes.map((tag) => ({ ...tag, ...(tag.id === id ? patch : {}), children: walk(tag.children ?? []) }))
  useTagStore.setState((s) => ({ tagTree: walk(s.tagTree) }))
}

function closeLocally(session: NativeRunningSession, end: number) {
  const segment = Math.max(0, Math.floor((end - session.startedAtMs) / 1000))
  const elapsed = session.baseElapsedSec + segment
  patchTag(session.tagId, { state: false, elapsedTime: elapsed, latestStopTimeMs: end, dailyTotalTime: session.dailyBaseSec + segment })
  return { segment, elapsed }
}

function queueStop(session: NativeRunningSession, end: number) {
  enqueuePendingTimerOperation({ type: 'stop', tagId: session.tagId, elapsedTime: session.baseElapsedSec + Math.max(0, Math.floor((end - session.startedAtMs) / 1000)), latestStartTime: session.startedAtMs, latestEndTime: end })
}

/** A single action lock covers Today, recent tags and the mini timer. */
export async function startTimer(tag: Tag, sw: StopwatchState, onStarted: (at: number) => void) {
  const runtime = useRunningTimerStore.getState()
  if (runtime.busy || runtime.session?.tagId === tag.id) return
  const member = useAuthStore.getState().memberId
  const start = Date.now()
  // A delayed view must not start before the last authoritative timer transition.
  if (serverTimerChangedAt(tag.latestStartTimeMs, tag.latestStopTimeMs) > start) return
  const saved = peekTimerState()
  const previous = runtime.session ?? sessionFromTimerState(saved, saved ? useTagStore.getState().findById(saved.tagId)?.name : undefined)
  if (previous?.tagId === tag.id) return
  useRunningTimerStore.setState({ busy: true, error: false, revision: runtime.revision + 1 })
  if (previous) closeLocally(previous, start)
  patchTag(tag.id, { state: true, latestStartTimeMs: start })
  saveTimerState({ tagId: tag.id, isRunning: true, elapsedTime: sw.elapsedTime, latestStartTime: start, latestEndTime: sw.latestEndTime, latestStopTimeMs: null, dailyTotalTime: sw.dailyTotalTime, dailyGoalTime: sw.dailyGoalTime })
  onStarted(start)
  void syncNativeRunningSession({ tagId: tag.id, tagName: tag.name, startedAtMs: start, baseElapsedSec: sw.elapsedTime, dailyBaseSec: sw.dailyTotalTime, dailyGoalSec: sw.dailyGoalTime })
  const enqueue = () => {
    if (previous) queueStop(previous, start)
    enqueuePendingTimerOperation({ type: 'start', tagId: tag.id, latestStartTime: start })
  }
  try {
    // Never overtake older offline segments with a newer live request.
    if (peekPendingTimerOperations().length) enqueue()
    else { await apiClient.post(`/api/v1/tags/${tag.id}/timer/start`, { startTime: new Date(start).toISOString() }); if (previous && useAuthStore.getState().memberId === member) recordsChanged() }
  } catch (error) {
    if (useAuthStore.getState().memberId === member) {
      const status = (error as { response?: { status?: number } }).response?.status
      if (status && status >= 400 && status < 500 && status !== 401) {
        clearTimerState()
        patchTag(tag.id, { state: false })
        useRunningTimerStore.setState({ error: true })
        void syncNativeRunningSession(null)
        if (member) useTagStore.getState().refreshTags(member)
      } else enqueue()
    }
  }
  finally {
    if (useAuthStore.getState().memberId === member && useRunningTimerStore.getState().revision === runtime.revision + 1) useRunningTimerStore.setState({ busy: false })
  }
}

export async function stopTimer(session: NativeRunningSession, onStopped?: (segment: number, end: number) => void) {
  const runtime = useRunningTimerStore.getState()
  if (runtime.busy) return
  const member = useAuthStore.getState().memberId
  const end = Date.now()
  useRunningTimerStore.setState({ busy: true, error: false, revision: runtime.revision + 1 })
  const { segment, elapsed } = closeLocally(session, end)
  saveTimerState({ tagId: session.tagId, isRunning: false, elapsedTime: elapsed, latestStartTime: session.startedAtMs, latestEndTime: end, latestStopTimeMs: end, dailyTotalTime: session.dailyBaseSec + segment, dailyGoalTime: session.dailyGoalSec })
  void syncNativeRunningSession(null)
  onStopped?.(segment, end)
  try {
    if (peekPendingTimerOperations().length) queueStop(session, end)
    else {
      await apiClient.post(`/api/v1/tags/${session.tagId}/timer/stop`, { elapsedTime: elapsed, timestamps: { startTime: new Date(session.startedAtMs).toISOString(), endTime: new Date(end).toISOString() } })
      if (useAuthStore.getState().memberId === member) recordsChanged()
      const local = peekTimerState()
      if (useAuthStore.getState().memberId === member && local?.tagId === session.tagId && !local.isRunning && local.latestEndTime === end) clearTimerState()
    }
  } catch (error) {
    if (useAuthStore.getState().memberId === member) {
      const status = (error as { response?: { status?: number } }).response?.status
      if (status && status >= 400 && status < 500 && status !== 401) {
        clearTimerState()
        useRunningTimerStore.setState({ error: true })
        if (member) useTagStore.getState().refreshTags(member)
      } else queueStop(session, end)
    }
  }
  finally {
    if (useAuthStore.getState().memberId === member && useRunningTimerStore.getState().revision === runtime.revision + 1) useRunningTimerStore.setState({ busy: false })
  }
  return segment
}
