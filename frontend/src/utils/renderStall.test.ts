import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/refreshAuth', () => ({ getPendingRefresh: vi.fn(() => null) }))

import {
  RENDER_RELOAD_COOLDOWN_MS,
  RENDER_STALL_THRESHOLD_MS,
  detectRenderStall,
  isReloadUnsafe,
  reloadForRenderStall,
} from './renderStall'
import { getPendingRefresh } from '@/utils/refreshAuth'
import { trackWriteEnd, trackWriteStart } from '@/utils/inflightWrites'

describe('detectRenderStall', () => {
  const now = 1_000_000

  it('요청한 프레임도 커밋도 없으면(아직 요청 전) 정지가 아니다', () => {
    expect(detectRenderStall(now, null, null)).toBeNull()
  })

  it('임계값 안에 아직 오지 않은 요청은 정지로 보지 않는다', () => {
    const recent = now - RENDER_STALL_THRESHOLD_MS + 1
    expect(detectRenderStall(now, recent, recent)).toBeNull()
  })

  it('요청한 프레임이 임계값을 넘도록 오지 않으면 frame 정지다', () => {
    expect(detectRenderStall(now, now - RENDER_STALL_THRESHOLD_MS, null)).toBe('frame')
  })

  it('요청한 커밋이 임계값을 넘도록 오지 않으면 commit 정지다', () => {
    expect(detectRenderStall(now, null, now - RENDER_STALL_THRESHOLD_MS)).toBe('commit')
  })

  it('미래 시각(시계 역행)에 찍힌 요청은 나이를 알 수 없으므로 정지로 보지 않는다', () => {
    expect(detectRenderStall(now, now + 60_000, now + 60_000)).toBeNull()
  })
})

describe('reloadForRenderStall', () => {
  const KEY = 'timemgr-render-stall-reload-at'
  let reload: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => {
    sessionStorage.clear()
    reload = vi.fn<() => void>()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('정지를 감지하면 페이지를 다시 열고, 그 시각을 남긴다', () => {
    expect(reloadForRenderStall('frame', { now: 5_000_000, reload })).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(KEY)).toBe('5000000')
  })

  it('[루프 방지] 직전 새로고침이 쿨다운 안이면 다시 열지 않는다', () => {
    sessionStorage.setItem(KEY, String(5_000_000))
    const now = 5_000_000 + RENDER_RELOAD_COOLDOWN_MS - 1
    expect(reloadForRenderStall('frame', { now, reload })).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('쿨다운이 지나면 다시 열 수 있다', () => {
    sessionStorage.setItem(KEY, String(5_000_000))
    const now = 5_000_000 + RENDER_RELOAD_COOLDOWN_MS
    expect(reloadForRenderStall('commit', { now, reload })).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('[루프 방지] 시각을 남길 수 없으면(저장소 차단) 새로고침하지 않는다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(reloadForRenderStall('frame', { now: 5_000_000, reload })).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('isReloadUnsafe', () => {
  const pendingRefresh = getPendingRefresh as unknown as ReturnType<typeof vi.fn>

  afterEach(() => {
    pendingRefresh.mockReturnValue(null)
  })

  it('진행 중인 요청이 없으면 새로고침해도 된다', () => {
    expect(isReloadUnsafe()).toBe(false)
  })

  it('[회귀] 쓰기 요청이 응답을 기다리는 중이면 미룬다 — 끊긴 타이머 조작은 큐에도 남지 않는다', () => {
    trackWriteStart()
    try {
      expect(isReloadUnsafe()).toBe(true)
    } finally {
      trackWriteEnd()
    }
    expect(isReloadUnsafe()).toBe(false)
  })

  it('[회귀] 토큰 갱신 중이면 미룬다 — 회전 응답을 끊으면 강제 로그아웃된다', () => {
    pendingRefresh.mockReturnValue(new Promise(() => {}))
    expect(isReloadUnsafe()).toBe(true)
  })
})
