import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const env = vi.hoisted(() => ({ pathname: '/logs', native: true }))
vi.mock('next/navigation', () => ({ usePathname: () => env.pathname }))
vi.mock('@/utils/platform', () => ({ isNativeApp: () => env.native }))
vi.mock('@/utils/apiClient', () => ({ default: { get: vi.fn() } }))
vi.mock('@/native/runningSession', () => ({ syncNativeRunningSession: vi.fn().mockResolvedValue(undefined) }))

import apiClient from '@/utils/apiClient'
import { syncNativeRunningSession } from '@/native/runningSession'
import { saveTimerState } from '@/utils/timerPersistence'
import { reportReachable, reportUnreachable } from '@/utils/connectivity'
import { NativeTimerSync } from './NativeTimerSync'

const get = vi.mocked(apiClient.get)
const sync = vi.mocked(syncNativeRunningSession)
const tag = (id = 1) => ({
  id, name: `Tag ${id}`, type: 'LEAF', state: true, elapsedTime: 10,
  latestStartTimeMs: Date.now() - 5_000, latestStopTimeMs: null, children: [],
})
const flush = () => act(async () => { await Promise.resolve() })

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  reportReachable()
  env.pathname = '/logs'
  env.native = true
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  get.mockReset().mockResolvedValue({ data: [tag()] })
  sync.mockClear()
})
afterEach(() => {
  cleanup()
  reportReachable()
  vi.useRealTimers()
  localStorage.clear()
})

describe('NativeTimerSync', () => {
  it.each(['/logs', '/profile', '/members/7/tags'])('%s에서도 복귀 시 서버 정지로 네이티브 표면을 지운다', async (path) => {
    env.pathname = path
    render(<NativeTimerSync memberId={7} />)
    await flush()
    expect(sync).toHaveBeenLastCalledWith(expect.objectContaining({ tagId: 1 }))
    get.mockResolvedValue({ data: [{ ...tag(), state: false, latestStopTimeMs: Date.now() }] })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(sync).toHaveBeenLastCalledWith(null)
  })

  it('다른 기기에서 태그를 바꾸면 새 실행 태그를 표시하고 휴지통은 제외한다', async () => {
    get.mockResolvedValue({ data: [
      { ...tag(), state: false },
      tag(2),
      { ...tag(3), type: 'DISCARDED', children: [{ ...tag(4), latestStartTimeMs: Date.now() }] },
    ] })
    render(<NativeTimerSync memberId={7} />)
    await flush()
    expect(sync).toHaveBeenLastCalledWith(expect.objectContaining({ tagId: 2, tagName: 'Tag 2' }))
  })

  it.each(['web', 'today', 'hidden', 'offline'])('%s에서는 조회하지 않는다', async (mode) => {
    if (mode === 'web') env.native = false
    if (mode === 'today') env.pathname = '/members/7/today'
    if (mode === 'hidden') Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    if (mode === 'offline') reportUnreachable()
    render(<NativeTimerSync memberId={7} />)
    await flush()
    expect(get).not.toHaveBeenCalled()
    expect(sync).not.toHaveBeenCalled()
  })

  it('조회 실패로 알림을 지우지 않으며 연결 복구 후 다시 조회한다', async () => {
    get.mockRejectedValueOnce(new Error('offline'))
    render(<NativeTimerSync memberId={7} />)
    await flush()
    expect(sync).not.toHaveBeenCalled()
    get.mockResolvedValue({ data: [] })
    await act(async () => { reportUnreachable(); reportReachable() })
    expect(sync).toHaveBeenLastCalledWith(null)
  })

  it('보이는 동안에만 주기적으로 갱신하고 언마운트에서 타이머를 정리한다', async () => {
    const { unmount } = render(<NativeTimerSync memberId={7} />)
    await flush()
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(get).toHaveBeenCalledTimes(2)
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
    expect(get).toHaveBeenCalledTimes(2)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['unmount', 'action', 'account', 'today'])('응답 대기 중 %s 후에는 이전 조회로 표면을 바꾸지 않는다', async (mode) => {
    let resolve!: (value: { data: ReturnType<typeof tag>[] }) => void
    get.mockReturnValueOnce(new Promise((res) => { resolve = res }))
    const view = render(<NativeTimerSync memberId={7} />)
    if (mode === 'unmount') view.unmount()
    if (mode === 'account') view.rerender(<NativeTimerSync memberId={8} />)
    if (mode === 'today') {
      env.pathname = '/members/7/today'
      view.rerender(<NativeTimerSync memberId={7} />)
    }
    if (mode === 'action') saveTimerState({
      tagId: 1, isRunning: false, elapsedTime: 10, latestStartTime: Date.now() - 5_000,
      latestEndTime: Date.now(), latestStopTimeMs: Date.now(), dailyTotalTime: 10, dailyGoalTime: 0,
    })
    await flush()
    sync.mockClear()
    await act(async () => { resolve({ data: [tag()] }) })
    expect(sync).not.toHaveBeenCalled()
  })
})
