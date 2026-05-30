'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { refreshAuth } from '@/utils/refreshAuth'

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

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { accessToken, memberId, clearAuth } = useAuthStore()
  const router = useRouter()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const init = async () => {
      if (!accessToken) {
        const token = await refreshAuth()
        if (!token) clearAuth()
      }
      setHydrated(true)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!accessToken || !memberId) router.replace('/login')
  }, [hydrated, accessToken, memberId, router])

  if (!hydrated) return <AuthSkeleton />
  if (!accessToken || !memberId) return null

  return <>{children}</>
}
