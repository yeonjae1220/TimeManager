'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { consumeOauthState } from '@/utils/oauthState'

export default function OAuthCallbackView() {
  const router = useRouter()
  const { googleLogin } = useAuth()
  const [error, setError] = useState('')
  const calledRef = useRef(false)

  useEffect(() => {
    // OAuth authorization code는 1회만 사용 가능 — Strict Mode 이중 실행 방지
    if (calledRef.current) return
    calledRef.current = true

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const oauthError = params.get('error')
    const returnedState = params.get('state')
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
      setError(msg || 'Google 로그인에 실패했습니다. 다시 시도해주세요.')
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
          <p className="mono" style={{ fontSize: 11, color: 'var(--danger)' }}>{error}</p>
          <Link href="/login" className="btn btn-primary">
            Back to Login
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
          Signing in...
        </p>
      </div>
    </div>
  )
}
