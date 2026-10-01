import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  OPTIMISTIC_SESSION_WINDOW_MS,
  canOpenOptimistically,
  useAuthStore,
} from './authStore'

const NOW = 1_800_000_000_000

beforeEach(() => {
  localStorage.clear()
  useAuthStore.setState({ accessToken: null, memberId: null, lastAuthOkAt: null })
})

afterEach(() => vi.useRealTimers())

describe('authStore — 마지막 인증 성공 시각', () => {
  it('setAuth 는 인증 성공 시각을 남긴다', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)

    useAuthStore.getState().setAuth('tok', 7)

    expect(useAuthStore.getState().lastAuthOkAt).toBe(NOW)
  })

  it('clearAuth 는 인증 성공 시각도 지운다', () => {
    useAuthStore.getState().setAuth('tok', 7)

    useAuthStore.getState().clearAuth()

    expect(useAuthStore.getState().lastAuthOkAt).toBeNull()
  })

  it('accessToken 은 저장하지 않고 memberId·lastAuthOkAt 만 localStorage 에 남긴다', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)

    useAuthStore.getState().setAuth('secret.access.token', 7)

    const raw = localStorage.getItem('timemgr-auth') ?? ''
    expect(raw).not.toContain('secret.access.token')
    expect(JSON.parse(raw).state).toEqual({ memberId: 7, lastAuthOkAt: NOW })
  })
})

describe('canOpenOptimistically', () => {
  it('memberId 가 있고 최근에 인증에 성공했으면 낙관적으로 연다', () => {
    expect(canOpenOptimistically({ memberId: 7, lastAuthOkAt: NOW - 60_000 }, NOW)).toBe(true)
  })

  it('memberId 가 없으면 열지 않는다', () => {
    expect(canOpenOptimistically({ memberId: null, lastAuthOkAt: NOW }, NOW)).toBe(false)
  })

  it('인증 성공 기록이 없으면(이 기능 이전 세션) 열지 않는다', () => {
    expect(canOpenOptimistically({ memberId: 7, lastAuthOkAt: null }, NOW)).toBe(false)
  })

  it('세션 창(서버 refresh 수명보다 짧게 잡은 값)을 넘기면 열지 않는다', () => {
    const stale = NOW - OPTIMISTIC_SESSION_WINDOW_MS
    expect(canOpenOptimistically({ memberId: 7, lastAuthOkAt: stale }, NOW)).toBe(false)
    expect(canOpenOptimistically({ memberId: 7, lastAuthOkAt: stale + 1 }, NOW)).toBe(true)
  })

  it('세션 창은 서버 refresh 수명(30일)보다 짧다', () => {
    // 서버는 24시간에 한 번만 회전하며 만료를 연장한다 — 마지막 성공이 회전 직전이 아닐 수
    // 있으므로 하루 이상 여유를 둬야 "열었다가 로그인으로 튕김"을 피한다.
    expect(OPTIMISTIC_SESSION_WINDOW_MS).toBeLessThanOrEqual(29 * 24 * 60 * 60 * 1000)
  })

  it('시계가 뒤로 간 경우(미래 시각 기록)는 믿지 않는다', () => {
    expect(canOpenOptimistically({ memberId: 7, lastAuthOkAt: NOW + 60_000 }, NOW)).toBe(false)
  })
})
