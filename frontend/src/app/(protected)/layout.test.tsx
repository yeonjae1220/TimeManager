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

describe('ProtectedLayout — 콜드 스타트 낙관적 렌더 (refresh 왕복을 기다리지 않는다)', () => {
  function deferredRefresh() {
    let resolve!: (value: Awaited<ReturnType<typeof refreshAuth>>) => void
    mockRefresh.mockImplementation(() => new Promise((res) => { resolve = res }))
    return { resolve: (v: Awaited<ReturnType<typeof refreshAuth>>) => resolve(v) }
  }

  it('[신규] memberId 흔적이 있으면 refresh 가 끝나기 전에도 즉시 앱 본체를 연다', () => {
    // 콜드 스타트에서 스켈레톤이 화면 전체(타이머 시작 버튼 포함)를 막던 것을 제거한다.
    useAuthStore.setState({ memberId: 7 })
    deferredRefresh()

    renderLayout()

    // waitFor 없이 첫 렌더에서 바로 통과해야 한다 — refresh는 아직 pending 이다.
    expect(screen.getByTestId('app-content')).toBeDefined()
  })

  it('[신규] 세션 흔적이 전혀 없으면 refresh 가 끝날 때까지는 그대로 스켈레톤이다', () => {
    // 보여줄 로컬 데이터가 없는 경우까지 낙관적으로 열면 안 된다 — UC4 와 동일한 경계.
    deferredRefresh()

    renderLayout()

    expect(screen.queryByTestId('app-content')).toBeNull()
  })

  it('[신규] 낙관적으로 연 뒤 unauthenticated 로 판명되면 화면을 다시 닫고 로그인으로 보낸다', async () => {
    useAuthStore.setState({ memberId: 7 })
    const gate = deferredRefresh()

    renderLayout()
    expect(screen.getByTestId('app-content')).toBeDefined() // 낙관적으로 이미 열려 있다

    gate.resolve({ status: 'unauthenticated' })

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
    expect(screen.queryByTestId('app-content')).toBeNull()
  })

  it('[신규] 낙관적으로 연 뒤 offline 로 판명되어도(memberId 보존) 화면은 계속 열려 있다', async () => {
    useAuthStore.setState({ memberId: 7 })
    const gate = deferredRefresh()

    renderLayout()
    expect(screen.getByTestId('app-content')).toBeDefined()

    gate.resolve({ status: 'offline' })

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('app-content')).toBeDefined()
    expect(replace).not.toHaveBeenCalled()
  })
})

describe('ProtectedLayout — hydration', () => {
  // 결함: 낙관적 통과 판정을 useState 초기화에서 하면, 서버(스토어·localStorage
  // 없음 → 스켈레톤)와 클라이언트 첫 렌더(zustand persist 로 복원된 memberId →
  // children)가 서로 다른 트리를 낸다. 그러면 hydration 이 서버가 그린 스켈레톤
  // 노드를 **컨테이너에 그대로 남긴 채** 앱 본체를 형제로 덧붙인다.
  //
  // 실측(수정 전): 컨테이너 자식이 2개였다.
  //   [0] <div> 828B  ← 펄스 스켈레톤(회색 막대 4개), 제거되지 않음
  //   [1] <div class="app-shell">  ← 새로 붙은 앱 본체
  // .app-shell 은 position:fixed 라 [0] 위에 겹치는데, 이때 배경이 없으면
  // 스켈레톤이 콘텐츠 영역 전체에 비쳐 "모든 화면 뒤에서 회색 막대가 깜빡"인다.
  // React 가 recoverable error 조차 남기지 않아 콘솔에 아무 흔적이 없다.
  it('[회귀] hydration 후 서버 스켈레톤이 DOM 에 남지 않는다', async () => {
    const [{ renderToString }, { hydrateRoot }, { act }] = await Promise.all([
      import('react-dom/server'),
      import('react-dom/client'),
      import('react'),
    ])
    // restore() 결과가 화면을 바꾸지 않도록 고정 — hydration 직후 DOM 만 본다.
    mockRefresh.mockImplementation(() => new Promise(() => {}))

    const tree = (
      <ProtectedLayout>
        <div className="app-shell" data-testid="app-content">앱 본체</div>
      </ProtectedLayout>
    )

    // 서버: 스토어도 localStorage 도 없다.
    const serverHtml = renderToString(tree)
    expect(serverHtml).toContain('pulse 1.4s ease infinite')

    const container = document.createElement('div')
    container.innerHTML = serverHtml
    document.body.appendChild(container)

    // 클라이언트: persist 가 이미 memberId 를 복원한 상태로 hydrate 를 시작한다.
    useAuthStore.setState({ memberId: 7 })
    await act(async () => { hydrateRoot(container, tree) })

    expect(container.querySelector('.app-shell')).not.toBeNull()
    expect(container.innerHTML).not.toContain('pulse 1.4s ease infinite')
    expect(container.children.length).toBe(1)

    container.remove()
  })
})
