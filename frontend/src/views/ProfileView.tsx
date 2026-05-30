'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { useAuthStore } from '@/store/authStore'
import { useAuth } from '@/hooks/useAuth'
import { memberApi } from '@/api/member'

export default function ProfileView() {
  const router = useRouter()
  const { logout } = useAuth()
  const { memberId } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleLogout() {
    setLoading(true)
    try {
      await logout()
    } catch {
      setLoading(false)
    }
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
      setError(msg || '계정 삭제에 실패했습니다.')
      setDeleting(false)
    }
  }

  return (
    <AppShell>
      <div className="page">
        <div className="topbar">
          <span className="topbar-brand">timemgr</span>
        </div>

        <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', gap: 32 }}>
          <div>
            <p className="mono" style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>
              account
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Member ID: {memberId}</p>
          </div>

          {error && <p className="auth-error">{error}</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              className="btn btn-ghost"
              onClick={handleLogout}
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {loading ? '...' : 'Sign out'}
            </button>

            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--danger)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.06em',
                cursor: 'pointer',
                opacity: deleting ? 0.4 : 1,
                padding: '8px 0',
                textAlign: 'center',
              }}
            >
              {deleting ? '...' : 'Delete account'}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
