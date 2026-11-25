'use client'

import Link from 'next/link'
import { useEffect, useId, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { saveOauthState } from '@/utils/oauthState'
import { createOauthState, openOAuthUrl } from '@/utils/nativeOAuth'
import { signInWithApple, supportsAppleSignIn } from '@/native/appleSignIn'
import { useI18n } from '@/i18n/I18nProvider'
import type { MessageKey } from '@/i18n/messages'

export default function LoginView() {
  const { login, appleLogin } = useAuth()
  const { t } = useI18n()
  const params = useSearchParams()
  const registered = params?.get('registered') === '1'
  const formId = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<MessageKey | null>(null)
  const [loading, setLoading] = useState(false)
  // 서버 문구(중복 이메일 등)는 번역 키가 아니라 원문이라 따로 둔다.
  const [appleError, setAppleError] = useState<string | null>(null)
  // 플러그인 존재는 window.Capacitor 로만 알 수 있다 — SSR·첫 렌더에선 false 로 두고 마운트 후 확인.
  const [canUseApple, setCanUseApple] = useState(false)

  useEffect(() => {
    setCanUseApple(supportsAppleSignIn())
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(email, password)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 400 || status === 401) setError('login.errorInvalid')
      else if (status === 429) setError('login.errorRate')
      else setError(status === undefined ? 'login.errorNetwork' : 'login.errorService')
    } finally {
      setLoading(false)
    }
  }

  async function handleAppleLogin() {
    setAppleError(null)
    const outcome = await signInWithApple()
    if (outcome.kind === 'cancelled') return
    if (outcome.kind === 'failed') {
      setAppleError(t('login.appleFail'))
      return
    }
    setLoading(true)
    try {
      await appleLogin(outcome.identityToken, outcome.authorizationCode, outcome.nonce, outcome.fullName)
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setAppleError(message || t('login.appleFail'))
    } finally {
      setLoading(false)
    }
  }

  function handleGoogleLogin() {
    const redirectUri = `${window.location.origin}/oauth/callback`
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) return
    // 네이티브에서 시작하면 state 에 릴레이 표식이 붙는다 — 콜백이 시스템 브라우저에
    // 남았을 때 그 페이지가 자기를 앱으로 되돌려야 하는지 판별하는 유일한 근거다.
    const state = createOauthState()
    saveOauthState(state)
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
    })
    void openOAuthUrl(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  }

  return (
    <div className="page auth-page">
      <div className="topbar">
        <span className="topbar-brand">timemgr</span>
      </div>

      <div className="auth-body">
        <div>
          <p className="auth-eyebrow">{t('login.eyebrow')}</p>
          <h1 className="auth-title">{t('login.title')}</h1>
        </div>

        {registered && <p role="status">{t('register.success')}</p>}
        <form className="auth-form" onSubmit={handleLogin}>
          <div className="field">
            <label htmlFor={formId + '-email'}>{t('auth.email')}</label>
            <input
              id={formId + '-email'}
              required
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={formId + '-password'}>{t('auth.password')}</label>
            <input
              id={formId + '-password'}
              required
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p role="alert" className="auth-error">{t(error)}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? '...' : (
              <>
                {t('login.submit')}
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2.5 6.5h8M7 3l3.5 3.5L7 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </>
            )}
          </button>
        </form>

        <div className="auth-divider"><span>{t('login.or')}</span></div>

        {canUseApple && (
          <button className="btn-apple" type="button" onClick={handleAppleLogin} disabled={loading}>
            <svg width="14" height="16" viewBox="0 0 814 1000" aria-hidden="true">
              <path fill="currentColor" d="M788 340c-6 4-108 62-108 190 0 148 130 200 134 202-1 3-21 72-69 142-43 62-88 124-156 124s-86-40-165-40c-77 0-104 41-166 41s-106-57-156-127C44 790 0 663 0 543c0-193 125-295 249-295 66 0 121 43 162 43 39 0 101-46 176-46 29 0 131 3 201 95zM555 156c31-37 53-88 53-140 0-7-1-14-2-20-50 2-110 34-146 76-28 32-55 83-55 135 0 8 1 16 2 18 3 1 9 2 14 2 45 0 102-30 134-71z"/>
            </svg>
            {t('login.apple')}
          </button>
        )}
        {appleError && <p role="alert" className="auth-error">{appleError}</p>}

        <button className="btn-google" type="button" onClick={handleGoogleLogin}>
          <svg width="16" height="16" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {t('login.google')}
        </button>

        <p className="auth-switch">
          {t('login.noAccount')}{' '}
          <Link href="/register" className="auth-link">{t('login.registerLink')}</Link>
        </p>
      </div>
    </div>
  )
}
