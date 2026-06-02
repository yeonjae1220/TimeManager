'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Moon, Sun } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import { useAuthStore } from '@/store/authStore'
import { useAuth } from '@/hooks/useAuth'
import { memberApi } from '@/api/member'
import apiClient from '@/utils/apiClient'
import { THEME_STORAGE_KEY } from '@/utils/theme'
import { useI18n } from '@/i18n/I18nProvider'
import { SUPPORTED_UI_LANGUAGES, LANGUAGE_LABELS } from '@/i18n/messages/index'

type ThemeMode = 'dark' | 'light'

interface Profile {
  id: number
  name: string
  email: string
  provider: string
  timezone: string
  dailyResetHour: number
}

export default function ProfileView() {
  const router = useRouter()
  const { logout } = useAuth()
  const { memberId } = useAuthStore()
  const { t, language, setLanguage } = useI18n()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadError, setLoadError] = useState('')

  // Editable fields
  const [name, setName] = useState('')
  const [dailyResetHour, setDailyResetHour] = useState(0)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [theme, setTheme] = useState<ThemeMode>('dark')

  useEffect(() => {
    const current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
    setTheme(current)
  }, [])

  function handleThemeChange(nextTheme: ThemeMode) {
    if (nextTheme === theme) return

    const root = document.documentElement
    root.classList.add('theme-transition')
    root.dataset.theme = nextTheme
    root.style.colorScheme = nextTheme
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    } catch {
      // Keep the in-session theme change even if browser storage is unavailable.
    }
    setTheme(nextTheme)

    window.setTimeout(() => {
      root.classList.remove('theme-transition')
    }, 240)
  }

  useEffect(() => {
    if (!memberId) return
    apiClient.get<Profile>(`/api/v1/members/${memberId}`)
      .then((res) => {
        setProfile(res.data)
        setName(res.data.name)
        setDailyResetHour(res.data.dailyResetHour)
      })
      .catch(() => setLoadError(t('profile.loadFail')))
  }, [memberId, t])

  async function handleSave() {
    if (!memberId) return
    if (newPassword && newPassword !== confirmPassword) {
      setSaveError(t('profile.pwMismatch'))
      return
    }
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)
    try {
      await apiClient.put(`/api/v1/members/${memberId}`, {
        name: name !== profile?.name ? name : undefined,
        dailyResetHour: dailyResetHour !== profile?.dailyResetHour ? dailyResetHour : undefined,
        currentPassword: newPassword ? currentPassword : undefined,
        newPassword: newPassword || undefined,
      })
      setProfile((prev) => prev ? { ...prev, name, dailyResetHour } : prev)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setSaveError(msg ?? t('common.saveFail'))
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    setLoading(true)
    try { await logout() } catch { setLoading(false) }
  }

  async function handleDeleteAccount() {
    if (!memberId) return
    if (!confirm(t('profile.deleteConfirm'))) return
    setDeleting(true)
    try {
      await memberApi.deleteMember(memberId)
      useAuthStore.getState().clearAuth()
      router.replace('/login')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setDeleteError(msg || t('profile.deleteFail'))
      setDeleting(false)
    }
  }

  const isGoogle = profile?.provider?.toLowerCase() === 'google'

  return (
    <AppShell>
      <div className="page">
        <div className="topbar">
          <span className="topbar-brand">timemgr</span>
        </div>

        <div style={{ padding: '32px 0', display: 'flex', flexDirection: 'column', gap: 32 }}>
          {loadError && <p className="mono" style={{ fontSize: 11, color: 'var(--danger)' }}>{loadError}</p>}

          {/* Account info */}
          <section>
            <p className="mono" style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>{t('profile.account')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('profile.email')}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{profile?.email ?? '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('profile.provider')}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{profile?.provider ?? '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('profile.timezone')}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{profile?.timezone ?? '—'}</span>
              </div>
            </div>
          </section>

          {/* Editable settings */}
          <section>
            <p className="mono" style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>{t('profile.settings')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{t('field.name')}</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                />
              </div>

              {/* Theme */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{t('profile.theme')}</label>
                <div
                  role="radiogroup"
                  aria-label={t('profile.themeAria')}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 3,
                    padding: 3,
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius)',
                  }}
                >
                  {([
                    { value: 'dark' as const, label: t('profile.dark'), Icon: Moon },
                    { value: 'light' as const, label: t('profile.light'), Icon: Sun },
                  ]).map(({ value, label, Icon }) => {
                    const selected = theme === value
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => handleThemeChange(value)}
                        className="mono"
                        style={{
                          height: 34,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 7,
                          border: '1px solid',
                          borderColor: selected ? 'var(--accent)' : 'transparent',
                          borderRadius: 'calc(var(--radius) - 2px)',
                          background: selected ? 'var(--accent-bg)' : 'transparent',
                          color: selected ? 'var(--accent)' : 'var(--text-2)',
                          fontSize: 11,
                          letterSpacing: '0.05em',
                          cursor: 'pointer',
                        }}
                      >
                        <Icon size={14} strokeWidth={1.8} />
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Daily reset hour */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{t('profile.dailyResetHour')}</label>
                  <span className="mono" style={{ fontSize: 13, color: 'var(--text)' }}>
                    {String(dailyResetHour).padStart(2, '0')}:00
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={23}
                  value={dailyResetHour}
                  onChange={(e) => setDailyResetHour(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
                <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>
                  {t('profile.resetHint', { time: `${String(dailyResetHour).padStart(2, '0')}:00` })}
                </p>
              </div>

              {/* Password change — Google 계정은 비활성화 */}
              {!isGoogle && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{t('profile.currentPw')}</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder={t('profile.currentPwPlaceholder')}
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{t('profile.newPw')}</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t('profile.newPwPlaceholder')}
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>{t('profile.confirmPw')}</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t('profile.confirmPwPlaceholder')}
                      style={{ background: 'var(--input-bg)', border: `1px solid ${newPassword && confirmPassword && newPassword !== confirmPassword ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                    />
                  </div>
                </>
              )}

              {isGoogle && (
                <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{t('profile.googleNoPw')}</p>
              )}

              {saveError && <p className="mono" style={{ fontSize: 11, color: 'var(--danger)' }}>{saveError}</p>}
              {saveSuccess && <p className="mono" style={{ fontSize: 11, color: 'var(--running)' }}>{t('profile.saved')}</p>}

              <button
                onClick={handleSave}
                disabled={saving}
                style={{ padding: '10px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'var(--bg)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', opacity: saving ? 0.4 : 1, letterSpacing: '0.05em' }}
              >
                {saving ? '...' : t('profile.saveChanges')}
              </button>
            </div>
          </section>

          {/* Language */}
          <section>
            <p className="mono" style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>{t('profile.uiLanguage')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SUPPORTED_UI_LANGUAGES.map((lang) => {
                const active = language === lang
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    aria-pressed={active}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius)',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'var(--accent-bg)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--text-2)',
                      fontSize: 12,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {LANGUAGE_LABELS[lang]}
                  </button>
                )
              })}
            </div>
            <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 10 }}>{t('profile.uiLanguageHint')}</p>
          </section>

          {/* Actions */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              className="btn btn-ghost"
              onClick={handleLogout}
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {loading ? '...' : t('profile.signOut')}
            </button>

            {deleteError && <p className="mono" style={{ fontSize: 11, color: 'var(--danger)' }}>{deleteError}</p>}
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              style={{ background: 'none', border: 'none', color: 'var(--danger)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer', opacity: deleting ? 0.4 : 1, padding: '8px 0', textAlign: 'center' }}
            >
              {deleting ? '...' : t('profile.deleteAccount')}
            </button>
          </section>
        </div>
      </div>
    </AppShell>
  )
}
