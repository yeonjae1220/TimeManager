import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'

vi.mock('@/utils/apiClient', () => ({ default: { get: vi.fn() } }))

import apiClient from '@/utils/apiClient'
import { __resetDailyResetHourCache, invalidateDailyResetHour, useDailyResetHour } from './useDailyResetHour'

const get = apiClient.get as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  get.mockReset()
  __resetDailyResetHourCache()
})

afterEach(() => {
  cleanup()
})

describe('useDailyResetHour — "오늘" 경계 계산에 필요한 회원 설정', () => {
  it('memberId가 없으면 조회하지 않고 null을 유지한다', () => {
    const { result } = renderHook(() => useDailyResetHour(null))
    expect(result.current.resetHour).toBeNull()
    expect(get).not.toHaveBeenCalled()
  })

  it('로딩 중에는 임의 기본값으로 위장하지 않고 null이다', async () => {
    let resolve!: (v: unknown) => void
    get.mockReturnValue(new Promise((r) => { resolve = r }))

    const { result } = renderHook(() => useDailyResetHour(7))
    expect(result.current.resetHour).toBeNull()

    await act(async () => {
      resolve({ data: { dailyResetHour: 5 } })
      await Promise.resolve()
    })
    await waitFor(() => expect(result.current.resetHour).toBe(5))
  })

  it('성공하면 서버가 준 dailyResetHour를 그대로 돌려준다', async () => {
    get.mockResolvedValue({ data: { dailyResetHour: 5 } })
    const { result } = renderHook(() => useDailyResetHour(7))

    await waitFor(() => expect(result.current.resetHour).toBe(5))
    expect(get).toHaveBeenCalledWith('/api/v1/members/7')
  })

  it('같은 memberId를 다른 컴포넌트에서 다시 요청해도 네트워크는 한 번만 호출한다(캐시)', async () => {
    get.mockResolvedValue({ data: { dailyResetHour: 5 } })
    const { result: r1 } = renderHook(() => useDailyResetHour(7))
    await waitFor(() => expect(r1.current.resetHour).toBe(5))

    const { result: r2 } = renderHook(() => useDailyResetHour(7))
    await waitFor(() => expect(r2.current.resetHour).toBe(5))

    expect(get).toHaveBeenCalledTimes(1)
  })

  it('실패하면 null을 유지한다(잘못된 기본값으로 위장하지 않는다)', async () => {
    get.mockRejectedValue(new Error('network'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useDailyResetHour(7))
    await waitFor(() => expect(get).toHaveBeenCalled())
    await act(async () => { await Promise.resolve() })

    expect(result.current.resetHour).toBeNull()
    errSpy.mockRestore()
  })

  // ── [회귀] 캐시가 프로필 변경 후에도 낡은 값을 영구히 돌려주면 안 된다 ──────────
  // Fix B가 없애려던 "오늘 경계 불일치"를 캐시 stale로 재도입하는 회귀를 막는다.

  it('[회귀] 프로필에서 dailyResetHour를 바꾼 뒤 invalidate하면 재방문 시 새 값을 받는다', async () => {
    get.mockResolvedValueOnce({ data: { dailyResetHour: 5 } })
    const { result: before } = renderHook(() => useDailyResetHour(7))
    await waitFor(() => expect(before.current.resetHour).toBe(5))

    // 프로필 저장 성공 경로가 호출해야 하는 것
    invalidateDailyResetHour(7)

    get.mockResolvedValueOnce({ data: { dailyResetHour: 2 } })
    const { result: after } = renderHook(() => useDailyResetHour(7))
    await waitFor(() => expect(after.current.resetHour).toBe(2))

    expect(get).toHaveBeenCalledTimes(2)
  })

  it('invalidate는 해당 memberId만 지운다(다른 회원 캐시는 유지)', async () => {
    get.mockResolvedValueOnce({ data: { dailyResetHour: 5 } })
    const { result: member7 } = renderHook(() => useDailyResetHour(7))
    await waitFor(() => expect(member7.current.resetHour).toBe(5))

    get.mockResolvedValueOnce({ data: { dailyResetHour: 3 } })
    const { result: member8 } = renderHook(() => useDailyResetHour(8))
    await waitFor(() => expect(member8.current.resetHour).toBe(3))

    invalidateDailyResetHour(7)
    get.mockClear()

    const { result: member8Again } = renderHook(() => useDailyResetHour(8))
    await waitFor(() => expect(member8Again.current.resetHour).toBe(3))
    expect(get).not.toHaveBeenCalled() // 8은 캐시 그대로 — 네트워크 호출 없음
  })

  // ── [회귀] 최초 조회가 실패해도 세션 내내 죽어있으면 안 된다 ──────────────────

  it('[회귀] reload()로 실패 이후에도 다시 시도할 수 있다', async () => {
    get.mockRejectedValueOnce(new Error('network'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useDailyResetHour(7))
    await waitFor(() => expect(result.current.resetHour).toBeNull())

    get.mockResolvedValueOnce({ data: { dailyResetHour: 5 } })
    await act(async () => {
      result.current.reload()
      await Promise.resolve()
    })

    await waitFor(() => expect(result.current.resetHour).toBe(5))
    errSpy.mockRestore()
  })
})
