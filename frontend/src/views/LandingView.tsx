'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

export default function LandingView() {
  const router = useRouter()
  const { accessToken, memberId } = useAuthStore()

  useEffect(() => {
    if (accessToken && memberId) {
      router.replace(`/members/${memberId}/today`)
    }
  }, [accessToken, memberId, router])

  return (
    <div className="page landing-page">
      <div className="topbar">
        <span className="topbar-brand">timemgr</span>
        <div className="topbar-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/login" className="btn btn-ghost topbar-btn">Sign in</Link>
          <Link href="/register" className="btn btn-primary topbar-btn">Get started</Link>
        </div>
      </div>

      <div className="landing-body" style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 52px)', paddingBottom: 60 }}>
        <div style={{ margin: '80px 0 48px' }}>
          <p className="mono" style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-block', width: 24, height: 1, background: 'var(--accent)', opacity: 0.5 }} />
            time tracking
          </p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(42px, 7vw, 68px)', lineHeight: 1.08, color: 'var(--text)', marginBottom: 24, letterSpacing: '-0.01em' }}>
            Every second<br />accounted for.
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.8, fontWeight: 300, maxWidth: 340 }}>
            A focused workspace for tracking what matters.<br />
            Start, stop, and review your time with precision.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 64, flexWrap: 'wrap' }}>
          <Link href="/register" className="btn btn-primary" style={{ height: 40, padding: '0 24px', fontSize: 13 }}>
            Get started — it's free
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2.5 6.5h8M7 3l3.5 3.5L7 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <Link href="/login" className="mono" style={{ fontSize: 11, color: 'var(--text-2)', letterSpacing: '0.04em' }}>
            Already have an account? Sign in
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border-subtle)', marginBottom: 'auto' }}>
          {[
            { title: 'Hierarchical tags', desc: 'Organize your work into nested tags. Track time at any level.' },
            { title: 'Precise stopwatch', desc: 'Session, daily, and lifetime totals — always up to date.' },
            { title: 'Full history', desc: 'Browse and edit every record. Nothing is lost.' },
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
