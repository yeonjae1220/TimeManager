'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { consumeOauthState } from '@/utils/oauthState'
import { isNativeApp } from '@/utils/platform'
import { buildNativeCallbackUrl, isNativeOauthState } from '@/utils/nativeOAuth'
import { useI18n } from '@/i18n/I18nProvider'

/** 자동 딥링크가 안 통했을 때 수동 버튼을 띄우기까지 기다리는 시간(ms). */
const HANDOFF_FALLBACK_DELAY = 1500

export default function OAuthCallbackView() {
  const router = useRouter()
  const { googleLogin } = useAuth()
  const { t } = useI18n()
  const [error, setError] = useState('')
  /** 앱으로 넘기는 중일 때의 딥링크. null 이면 이 컨텍스트에서 교환까지 진행한다. */
  const [handoffUrl, setHandoffUrl] = useState<string | null>(null)
  const [handoffStalled, setHandoffStalled] = useState(false)
  const calledRef = useRef(false)

  useEffect(() => {
    // OAuth authorization code는 1회만 사용 가능 — Strict Mode 이중 실행 방지
    if (calledRef.current) return
    calledRef.current = true

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const oauthError = params.get('error')
    const returnedState = params.get('state')

    // 앱에서 시작한 플로우인데 여기가 앱 WebView 가 아니다 = Universal/App Links 가
    // 콜백을 가로채지 못하고 시스템 브라우저에 그대로 남았다. 커스텀 스킴으로 앱에 넘긴다.
    //
    // ⚠️ 반드시 state 검증·code 교환보다 먼저다. state 쿠키는 앱 WebView 쪽 저장소에 있어
    // 여기서는 항상 null 이고, 그대로 진행하면 CSRF 불일치로 /login 에 튕겨 code 를 버린다.
    if (!isNativeApp() && isNativeOauthState(returnedState)) {
      const deepLink = buildNativeCallbackUrl(window.location.search)
      setHandoffUrl(deepLink)
      // 자동 이동은 브라우저가 막을 수 있다(사용자 제스처 없는 외부 스킴 이동 차단).
      // 그래서 실패를 조용히 두지 않고 잠시 뒤 수동 버튼을 띄운다. 던지더라도 그 수동
      // 경로까지 같이 죽이면 안 되므로 여기서 가둔다.
      // replace 인 이유: code 가 담긴 URL 을 브라우저 히스토리에 남기지 않는다.
      try {
        window.location.replace(deepLink)
      } catch (e) {
        console.error('[oauth] 앱 딥링크 자동 이동 실패 — 수동 버튼으로 대체', e)
      }
      return
    }

    const savedState = consumeOauthState()

    if (oauthError || !code) {
      router.replace('/login')
      return
    }

    // state 불일치 시 login CSRF 공격 차단
    if (!returnedState || returnedState !== savedState) {
      router.replace('/login')
      return
    }

    const redirectUri = `${window.location.origin}/oauth/callback`
    googleLogin(code, redirectUri).catch((e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || t('oauth.googleFail'))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!handoffUrl) return
    const timer = setTimeout(() => setHandoffStalled(true), HANDOFF_FALLBACK_DELAY)
    return () => clearTimeout(timer)
  }, [handoffUrl])

  if (handoffUrl) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
          <div className="spinner" />
          <p className="mono" style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-2)', textTransform: 'uppercase' }}>
            {t('oauth.returningToApp')}
          </p>
          {handoffStalled && (
            <>
              <p className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{t('oauth.openAppHint')}</p>
              <a href={handoffUrl} className="btn btn-primary">{t('oauth.openApp')}</a>
            </>
          )}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
          <p className="mono" style={{ fontSize: 11, color: 'var(--danger)' }}>{error}</p>
          <Link href="/login" className="btn btn-primary">
            {t('oauth.backToLogin')}
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2.5 6.5h8M7 3l3.5 3.5L7 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div className="spinner" />
        <p className="mono" style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-2)', textTransform: 'uppercase' }}>
          {t('oauth.signingIn')}
        </p>
      </div>
    </div>
  )
}
