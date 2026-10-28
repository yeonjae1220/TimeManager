import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('./apiClient', () => ({ default: { post: vi.fn(), get: vi.fn() } }))
vi.mock('@/native/runningSession', () => ({ syncNativeRunningSession: vi.fn(async (session) => { useRunningTimerStore.setState({ session }) }), sessionFromTimerState: () => null }))
import apiClient from './apiClient'
import { useRunningTimerStore } from '@/store/runningTimerStore'
import { useAuthStore } from '@/store/authStore'
import { useTagStore, selectTagList, type Tag } from '@/store/tagStore'
import { computeStopwatchState } from './stopwatchState'
import { peekPendingTimerOperations, peekTimerState } from './timerPersistence'
import { startTimer, stopTimer } from './timerActions'
const tag = { id: 2, name: 'Next', state: false, elapsedTime: 0, latestStartTimeMs: null, latestStopTimeMs: 0, children: [] } as unknown as Tag
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks(); useAuthStore.setState({ memberId: 7 });
  useRunningTimerStore.setState({ session: null, busy: false, revision: 0, memberId: 7 });
  useTagStore.setState({ tagTree: [tag], _activeMemberId: 7 });
})
describe('shared timer actions', () => {
  it('offline switch preserves the old stop and new start at a single instant', async () => {
    useRunningTimerStore.setState({ session: { tagId: 1, tagName: 'Previous', startedAtMs: Date.now() - 60_000, baseElapsedSec: 0, dailyBaseSec: 0, dailyGoalSec: 0 } })
    vi.mocked(apiClient.post).mockRejectedValue(new Error('offline'))
    await startTimer(tag, computeStopwatchState(2, tag), () => {})
    const ops = peekPendingTimerOperations()
    expect(ops.map((op) => op.type)).toEqual(['stop', 'start'])
    expect(ops[0].type === 'stop' && ops[0].latestEndTime).toBe(ops[1].type === 'start' && ops[1].latestStartTime)
    expect(peekTimerState()).toMatchObject({ tagId: 2, isRunning: true })
  })
  it('a rapid duplicate start or mini stop cannot overtake an outstanding start', async () => {
    let finish!: (result: unknown) => void
    vi.mocked(apiClient.post).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const sw = computeStopwatchState(2, tag)
    const first = startTimer(tag, sw, () => {})
    await startTimer(tag, sw, () => {})
    await stopTimer(useRunningTimerStore.getState().session!)
    expect(apiClient.post).toHaveBeenCalledTimes(1)
    finish({}); await first
  })
  it('an empty tag selector returns a stable snapshot during initial loading', () => {
    useTagStore.setState({ tagTree: [] })
    expect(selectTagList(useTagStore.getState())).toBe(selectTagList(useTagStore.getState()))
  })
})
