'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { refreshAuth } from '@/utils/refreshAuth'
import { useI18n } from '@/i18n/I18nProvider'

type AuthPhase = 'restoring' | 'ready' | 'offline'

function AuthSkeleton() {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 260 }}>
        {[70, 50, 50, 30].map((w, i) => (
          <div key={i} style={{
            height: 12, borderRadius: 6, background: 'var(--surface-2)',
            width: `${w}%`, animation: 'pulse 1.4s ease infinite',
            animationDelay: `${i * 0.12}s`,
          }} />
        ))}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:.7}}`}</style>
    </div>
  )
}

function ReconnectScreen({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const { t } = useI18n()
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, maxWidth: 280, textAlign: 'center' }}>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.4s ease infinite' }} />
        <p role="status" aria-live="polite" style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>{t('auth.reconnecting')}</p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onRetry}
          disabled={retrying}
          style={{ height: 36, padding: '0 20px', fontSize: 13 }}
        >
          {t('auth.retry')}
        </button>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:.7}}`}</style>
    </div>
  )
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { memberId, clearAuth } = useAuthStore()
  const router = useRouter()
  const [phase, setPhase] = useState<AuthPhase>('restoring')
  const [retrying, setRetrying] = useState(false)
  const inFlight = useRef(false)

  const restore = useCallback(async () => {
    if (inFlight.current) return
    // 이미 메모리에 토큰이 있으면(앱 내 네비게이션) refresh 불필요
    if (useAuthStore.getState().accessToken) {
      setPhase('ready')
      return
    }
    inFlight.current = true
    setRetrying(true)
    try {
      const result = await refreshAuth()
      if (result.status === 'authenticated') {
        setPhase('ready')
      } else if (result.status === 'unauthenticated') {
        clearAuth()
        router.replace('/login')
      } else {
        setPhase('offline')
      }
    } finally {
      inFlight.current = false
      setRetrying(false)
    }
  }, [clearAuth, router])

  // 최초 복원
  useEffect(() => {
    if (useAuthStore.getState().accessToken) {
      setPhase('ready')
      return
    }
    if (!useAuthStore.getState().memberId) {
      router.replace('/login')
      return
    }
    void restore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 연결 복구 시(온라인 전환·앱 포그라운드 복귀) 자동 재시도
  useEffect(() => {
    if (phase !== 'offline') return
    const onReconnectSignal = () => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        void restore()
      }
    }
    window.addEventListener('online', onReconnectSignal)
    document.addEventListener('visibilitychange', onReconnectSignal)
    return () => {
      window.removeEventListener('online', onReconnectSignal)
      document.removeEventListener('visibilitychange', onReconnectSignal)
    }
  }, [phase, restore])

  if (phase === 'restoring') return <AuthSkeleton />
  if (phase === 'offline') return <ReconnectScreen onRetry={() => void restore()} retrying={retrying} />
  if (!memberId) return null

  return <>{children}</>
}
