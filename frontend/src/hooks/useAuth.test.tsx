import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuth } from './useAuth'
import { syncNativeRunningSession } from '@/native/runningSession'
import { useAuthStore } from '@/store/authStore'

const push = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const authApi = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  googleLogin: vi.fn(),
}))
vi.mock('@/api/auth', () => ({ authApi }))

vi.mock('@/native/runningSession', () => ({
  syncNativeRunningSession: vi.fn().mockResolvedValue(undefined),
}))

const syncNative = vi.mocked(syncNativeRunningSession)

/**
 * 로그아웃은 화면만 바꾸는 것이 아니다. 예약된 로컬 알림과 실행중 표시는 **OS 가 들고
 * 있어서** 앱 상태를 지운다고 사라지지 않는다. 정리하지 않으면 로그아웃한 뒤에도
 * "3시간 되었습니다"가 튀어나오고, 상태표시줄에는 남의 타이머가 계속 흐른다.
 */
describe('useAuth · logout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authApi.logout.mockResolvedValue(undefined)
    useAuthStore.setState({ accessToken: 'token', memberId: 1, role: 'USER' })
  })

  it('네이티브 표면을 정리한다', async () => {
    const { result } = renderHook(() => useAuth())

    await result.current.logout()

    expect(syncNative).toHaveBeenCalledWith(null)
  })

  it('서버 로그아웃이 실패해도 네이티브 표면은 정리한다 — 실패할수록 유령이 남는다', async () => {
    authApi.logout.mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => useAuth())

    await result.current.logout()

    expect(syncNative).toHaveBeenCalledWith(null)
  })

  it('세션을 비우고 로그인 화면으로 보낸다', async () => {
    const { result } = renderHook(() => useAuth())

    await result.current.logout()

    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(push).toHaveBeenCalledWith('/login')
  })

  /**
   * 네이티브 정리가 라우팅보다 늦으면 화면이 먼저 바뀌며 컴포넌트가 언마운트되고,
   * 그 과정에서 다른 sync 가 끼어들 수 있다. 정리를 먼저 끝낸다.
   */
  it('네이티브 정리를 라우팅보다 먼저 한다', async () => {
    const order: string[] = []
    syncNative.mockImplementation(async () => { order.push('sync') })
    push.mockImplementation(() => { order.push('push') })
    const { result } = renderHook(() => useAuth())

    await result.current.logout()

    expect(order).toEqual(['sync', 'push'])
  })
})
