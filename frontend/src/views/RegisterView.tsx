'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n/I18nProvider'

export default function RegisterView() {
  const { register } = useAuth()
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function validatePassword(pw: string): string | null {
    if (pw.length < 8) return t('register.pwMin')
    if (!/[A-Z]/.test(pw)) return t('register.pwUpper')
    if (!/[a-z]/.test(pw)) return t('register.pwLower')
    if (!/[0-9]/.test(pw)) return t('register.pwDigit')
    return null
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    const pwError = validatePassword(password)
    if (pwError) { setError(pwError); return }
    setLoading(true)
    setError('')
    try {
      await register(name, email, password)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || t('register.fail'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page auth-page">
      <div className="topbar">
        <span className="topbar-brand">timemgr</span>
      </div>

      <div className="auth-body">
        <div>
          <p className="auth-eyebrow">{t('register.eyebrow')}</p>
          <h1 className="auth-title">{t('register.title')}</h1>
        </div>

        <form className="auth-form" onSubmit={handleRegister}>
          <div className="field">
            <label>{t('register.name')}</label>
            <input
              type="text"
              autoComplete="name"
              placeholder={t('register.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label>{t('auth.email')}</label>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label>{t('auth.password')}</label>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? '...' : (
              <>
                {t('register.submit')}
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2.5 6.5h8M7 3l3.5 3.5L7 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </>
            )}
          </button>
        </form>

        <p className="auth-switch">
          {t('register.haveAccount')}{' '}
          <Link href="/login" className="auth-link">{t('register.signInLink')}</Link>
        </p>
      </div>
    </div>
  )
}
