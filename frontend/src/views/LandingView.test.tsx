import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

const replace = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }))
vi.mock('@/utils/refreshAuth', () => ({ refreshAuth: vi.fn() }))
vi.mock('@/i18n/I18nProvider', () => ({ useI18n: () => ({ t: (k: string) => k }) }))
vi.mock('@/components/ui/UiLanguageSwitcher', () => ({ UiLanguageSwitcher: () => null }))
vi.mock('@/components/ui/ThemeToggle', () => ({ ThemeToggle: () => null }))

import { refreshAuth } from '@/utils/refreshAuth'
import { OPTIMISTIC_SESSION_WINDOW_MS, useAuthStore } from '@/store/authStore'
import LandingView from './LandingView'

const mockRefresh = refreshAuth as unknown as ReturnType<typeof vi.fn>
const pendingForever = () => new Promise(() => {})

beforeEach(() => {
  replace.mockReset()
  mockRefresh.mockReset()
  localStorage.clear()
  useAuthStore.setState({ accessToken: null, memberId: null, lastAuthOkAt: null })
})

afterEach(() => cleanup())

describe('LandingView — 콜드 스타트 낙관적 진입', () => {
  it('최근에 인증된 세션 흔적이 있으면 refresh 를 기다리지 않고 바로 타이머 화면으로 보낸다', () => {
    // PWA start_url 이 '/' 라 콜드 스타트는 항상 여기서 시작한다. refresh 왕복을 기다리면
    // 그동안 스플래시만 보이고 캐시된 타이머 화면이 늦게 뜬다.
    useAuthStore.setState({ memberId: 7, lastAuthOkAt: Date.now() - 60_000 })
    mockRefresh.mockImplementation(pendingForever)

    render(<LandingView />)

    expect(replace).toHaveBeenCalledWith('/members/7/today')
  })

  it('낙관적으로 보낼 때도 refresh 는 곧바로 시작한다(보호 레이아웃이 같은 요청을 공유)', () => {
    useAuthStore.setState({ memberId: 7, lastAuthOkAt: Date.now() - 60_000 })
    mockRefresh.mockImplementation(pendingForever)

    render(<LandingView />)

    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('낙관적으로 보낸 뒤 refresh 가 unauthenticated 면 로그인으로 보낸다', async () => {
    // 보호 레이아웃이 마운트되기 전에 판명되면 clearAuth 로 흔적이 지워져, 레이아웃은
    // 같은 죽은 쿠키로 refresh 를 한 번 더 하게 된다. 판명된 쪽에서 바로 보낸다.
    useAuthStore.setState({ memberId: 7, lastAuthOkAt: Date.now() - 60_000 })
    mockRefresh.mockResolvedValue({ status: 'unauthenticated' })

    render(<LandingView />)

    expect(replace).toHaveBeenCalledWith('/members/7/today')
    await waitFor(() => expect(replace).toHaveBeenLastCalledWith('/login'))
  })

  it('세션 흔적이 오래됐으면(서버 세션이 이미 만료됐을 수 있음) refresh 결과를 기다린다', async () => {
    // 열었다가 로그인으로 튕기는 깜빡임을 막는다.
    useAuthStore.setState({ memberId: 7, lastAuthOkAt: Date.now() - OPTIMISTIC_SESSION_WINDOW_MS - 1 })
    mockRefresh.mockResolvedValue({ status: 'unauthenticated' })

    render(<LandingView />)

    await waitFor(() => expect(screen.getByText('landing.heroTitle')).toBeDefined())
    expect(replace).not.toHaveBeenCalled()
  })

  it('인증 성공 기록이 없으면 refresh 결과를 기다린 뒤, 성공하면 복원된 회원의 화면으로 보낸다', async () => {
    // memberId 가 사라졌어도 쿠키가 살아 있으면 복원한다(PIT-053) — 게이트는 refresh 다.
    mockRefresh.mockImplementation(async () => {
      useAuthStore.setState({ accessToken: 'tok', memberId: 9, lastAuthOkAt: Date.now() })
      return { status: 'authenticated', token: 'tok' }
    })

    render(<LandingView />)

    expect(replace).not.toHaveBeenCalled() // 기다리는 중
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/members/9/today'))
  })

  it('오프라인이어도 이 기기에 세션 흔적이 있으면 타이머 화면으로 보낸다(로컬 캐시로 연다)', async () => {
    // 보호 레이아웃은 이미 offline + memberId 를 연다. 랜딩만 막으면 오프라인 콜드
    // 스타트가 마케팅 페이지에서 멈춘다.
    useAuthStore.setState({ memberId: 7, lastAuthOkAt: null })
    mockRefresh.mockResolvedValue({ status: 'offline' })

    render(<LandingView />)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/members/7/today'))
  })

  it('오프라인이고 세션 흔적이 없으면 랜딩을 보여준다', async () => {
    mockRefresh.mockResolvedValue({ status: 'offline' })

    render(<LandingView />)

    await waitFor(() => expect(screen.getByText('landing.heroTitle')).toBeDefined())
    expect(replace).not.toHaveBeenCalled()
  })

  it('메모리에 토큰이 있으면(앱 내 이동) refresh 없이 바로 보낸다', () => {
    useAuthStore.setState({ accessToken: 'tok', memberId: 7 })

    render(<LandingView />)

    expect(replace).toHaveBeenCalledWith('/members/7/today')
    expect(mockRefresh).not.toHaveBeenCalled()
  })
})
