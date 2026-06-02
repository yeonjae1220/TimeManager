'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { refreshAuth } from '@/utils/refreshAuth'
import { useI18n } from '@/i18n/I18nProvider'

function LandingSplash() {
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

export default function LandingView() {
  const router = useRouter()
  const { t } = useI18n()
  const { accessToken, memberId } = useAuthStore()
  // memberId가 persist에 남아 있으면 refresh token으로 세션 복원을 시도한다.
  // 복원하는 동안 랜딩 대신 스플래시를 보여 깜빡임을 막는다.
  // SSR/CSR 모두 true로 시작해 hydration 불일치를 막는다.
  // useEffect에서 memberId 없으면 즉시 false로 전환.
  const [restoring, setRestoring] = useState(true)

  useEffect(() => {
    if (accessToken && memberId) {
      router.replace(`/members/${memberId}/today`)
      return
    }

    if (!accessToken && memberId) {
      refreshAuth().then((token) => {
        if (token) {
          router.replace(`/members/${memberId}/today`)
        } else {
          setRestoring(false)
        }
      })
      return
    }

    setRestoring(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (restoring) return <LandingSplash />

  return (
    <div className="page landing-page">
      <div className="topbar">
        <span className="topbar-brand">timemgr</span>
        <div className="topbar-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/login" className="btn btn-ghost topbar-btn">{t('landing.signIn')}</Link>
          <Link href="/register" className="btn btn-primary topbar-btn">{t('landing.getStarted')}</Link>
        </div>
      </div>

      <div className="landing-body" style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 52px)', paddingBottom: 60 }}>
        <div style={{ margin: '80px 0 48px' }}>
          <p className="mono" style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-block', width: 24, height: 1, background: 'var(--accent)', opacity: 0.5 }} />
            {t('landing.eyebrow')}
          </p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(42px, 7vw, 68px)', lineHeight: 1.08, color: 'var(--text)', marginBottom: 24, letterSpacing: '-0.01em' }}>
            {t('landing.heroTitle')}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.8, fontWeight: 300, maxWidth: 340 }}>
            {t('landing.heroSubtitle')}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 64, flexWrap: 'wrap' }}>
          <Link href="/register" className="btn btn-primary" style={{ height: 40, padding: '0 24px', fontSize: 13 }}>
            {t('landing.ctaFree')}
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2.5 6.5h8M7 3l3.5 3.5L7 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <Link href="/login" className="mono" style={{ fontSize: 11, color: 'var(--text-2)', letterSpacing: '0.04em' }}>
            {t('landing.haveAccountInline')}
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border-subtle)', marginBottom: 'auto' }}>
          {[
            { title: t('landing.feature1Title'), desc: t('landing.feature1Desc') },
            { title: t('landing.feature2Title'), desc: t('landing.feature2Desc') },
            { title: t('landing.feature3Title'), desc: t('landing.feature3Desc') },
          ].map(({ title, desc }) => (
            <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 20, padding: '24px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 6 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{title}</p>
                <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <footer style={{ marginTop: 40 }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>timemgr · v0.1</span>
        </footer>
      </div>
    </div>
  )
}
