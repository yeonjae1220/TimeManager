import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const login = vi.fn()
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ login, appleLogin: vi.fn() }) }))
vi.mock('next/navigation', () => ({ useSearchParams: () => null }))
vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('@/i18n/I18nProvider', () => ({ useI18n: () => ({ t: (k: string) => k }) }))
vi.mock('@/native/appleSignIn', () => ({ signInWithApple: vi.fn(), supportsAppleSignIn: () => false }))
vi.mock('@/utils/nativeOAuth', () => ({ createOauthState: vi.fn(), openOAuthUrl: vi.fn() }))
vi.mock('@/utils/oauthState', () => ({ saveOauthState: vi.fn() }))

import LoginView from './LoginView'

afterEach(() => {
  cleanup()
  login.mockReset()
})

describe('LoginView — 로그인 실패 문구', () => {
  // 서버는 없는 이메일·소셜 전용 계정·틀린 비밀번호를 모두 401 + 같은 문구로 준다(가입 여부 비노출).
  it.each([401, 400])('%i 이면 자격증명 오류 문구를 띄운다', async (status) => {
    login.mockRejectedValue({ response: { status, data: { error: 'x' } } })
    const { container } = render(<LoginView />)

    fireEvent.submit(container.querySelector('form')!)

    expect((await screen.findByRole('alert')).textContent).toBe('login.errorInvalid')
  })
})
