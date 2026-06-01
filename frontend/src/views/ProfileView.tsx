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
      .catch(() => setLoadError('프로필을 불러오지 못했습니다.'))
  }, [memberId])

  async function handleSave() {
    if (!memberId) return
    if (newPassword && newPassword !== confirmPassword) {
      setSaveError('새 비밀번호가 일치하지 않습니다.')
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
      setSaveError(msg ?? '저장에 실패했습니다.')
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
    if (!confirm('계정을 삭제하면 모든 데이터가 사라집니다. 정말 삭제할까요?')) return
    setDeleting(true)
    try {
      await memberApi.deleteMember(memberId)
      useAuthStore.getState().clearAuth()
      router.replace('/login')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setDeleteError(msg || '계정 삭제에 실패했습니다.')
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
            <p className="mono" style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>account</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>email</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{profile?.email ?? '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>provider</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{profile?.provider ?? '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>timezone</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{profile?.timezone ?? '—'}</span>
              </div>
            </div>
          </section>

          {/* Editable settings */}
          <section>
            <p className="mono" style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>settings</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>NAME</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                />
              </div>

              {/* Theme */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>THEME</label>
                <div
                  role="radiogroup"
                  aria-label="Theme"
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
                    { value: 'dark' as const, label: 'Dark', Icon: Moon },
                    { value: 'light' as const, label: 'Light', Icon: Sun },
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
                  <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>DAILY RESET HOUR</label>
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
                  오늘 통계가 {String(dailyResetHour).padStart(2, '0')}:00 에 초기화됩니다
                </p>
              </div>

              {/* Password change — Google 계정은 비활성화 */}
              {!isGoogle && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>CURRENT PASSWORD</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="현재 비밀번호"
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>NEW PASSWORD</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="새 비밀번호 (변경 시에만)"
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label className="mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>CONFIRM PASSWORD</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="새 비밀번호 확인"
                      style={{ background: 'var(--input-bg)', border: `1px solid ${newPassword && confirmPassword && newPassword !== confirmPassword ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                    />
                  </div>
                </>
              )}

              {isGoogle && (
                <p className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>Google 계정은 비밀번호 변경이 불가합니다</p>
              )}

              {saveError && <p className="mono" style={{ fontSize: 11, color: 'var(--danger)' }}>{saveError}</p>}
              {saveSuccess && <p className="mono" style={{ fontSize: 11, color: 'var(--running)' }}>저장됐습니다</p>}

              <button
                onClick={handleSave}
                disabled={saving}
                style={{ padding: '10px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'var(--bg)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', opacity: saving ? 0.4 : 1, letterSpacing: '0.05em' }}
              >
                {saving ? '...' : 'Save changes'}
              </button>
            </div>
          </section>

          {/* Actions */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              className="btn btn-ghost"
              onClick={handleLogout}
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {loading ? '...' : 'Sign out'}
            </button>

            {deleteError && <p className="mono" style={{ fontSize: 11, color: 'var(--danger)' }}>{deleteError}</p>}
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              style={{ background: 'none', border: 'none', color: 'var(--danger)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer', opacity: deleting ? 0.4 : 1, padding: '8px 0', textAlign: 'center' }}
            >
              {deleting ? '...' : 'Delete account'}
            </button>
          </section>
        </div>
      </div>
    </AppShell>
  )
}
