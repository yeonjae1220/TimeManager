import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

const replace = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }))
vi.mock('@/utils/refreshAuth', () => ({ refreshAuth: vi.fn() }))
vi.mock('@/i18n/I18nProvider', () => ({ useI18n: () => ({ t: (k: string) => k }) }))

import { refreshAuth } from '@/utils/refreshAuth'
import { useAuthStore } from '@/store/authStore'
import ProtectedLayout from './layout'

const mockRefresh = refreshAuth as unknown as ReturnType<typeof vi.fn>

function renderLayout() {
  return render(
    <ProtectedLayout>
      <div data-testid="app-content">앱 본체</div>
    </ProtectedLayout>
  )
}

beforeEach(() => {
  replace.mockReset()
  mockRefresh.mockReset()
  localStorage.clear()
  useAuthStore.setState({ accessToken: null, memberId: null, role: null })
})

afterEach(() => cleanup())

describe('ProtectedLayout — 오프라인 접근 게이트', () => {
  it('[UC1] 오프라인이고 이전 세션이 있으면 앱 본체를 연다', async () => {
    // 오프라인 중에도 타이머를 쓰려면 여기서 막히면 안 된다.
    // 로컬 캐시(태그·타이머 상태)로 화면이 서고, 조작은 대기 큐에 쌓인다.
    useAuthStore.setState({ memberId: 7 })
    mockRefresh.mockResolvedValue({ status: 'offline' })

    renderLayout()

    await waitFor(() => expect(screen.getByTestId('app-content')).toBeDefined())
    expect(replace).not.toHaveBeenCalled()
  })

  it('[UC4] 오프라인이고 이전 세션이 없으면 앱을 열지 않는다', async () => {
    // 이 기기에서 로그인한 적이 없다 — 보여줄 로컬 데이터도, 붙일 세션도 없다.
    mockRefresh.mockResolvedValue({ status: 'offline' })

    renderLayout()

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
    expect(screen.queryByTestId('app-content')).toBeNull()
  })

  it('[EC10] 세션 만료가 확정되면(unauthenticated) 오프라인 통과 없이 로그인으로 보낸다', async () => {
    // memberId 가 남아 있어도 서버가 "자격 없음"이라 답했으면 앱을 열면 안 된다.
    useAuthStore.setState({ memberId: 7 })
    mockRefresh.mockResolvedValue({ status: 'unauthenticated' })

    renderLayout()

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
    expect(screen.queryByTestId('app-content')).toBeNull()
  })

  it('[EC10] memberId 유무와 무관하게 refresh 를 항상 먼저 시도한다', async () => {
    // 로컬 캐시 필드를 게이트로 쓰면 쿠키가 살아있어도 복원을 시도조차 못 한다(PIT-053).
    mockRefresh.mockResolvedValue({ status: 'authenticated', token: 't' })

    renderLayout()

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1))
  })

  it('온라인 정상 복원이면 앱 본체를 연다', async () => {
    useAuthStore.setState({ memberId: 7 })
    mockRefresh.mockImplementation(async () => {
      useAuthStore.setState({ accessToken: 'tok' })
      return { status: 'authenticated', token: 'tok' }
    })

    renderLayout()

    await waitFor(() => expect(screen.getByTestId('app-content')).toBeDefined())
  })
})
