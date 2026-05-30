'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { accessToken, memberId, setAuth, clearAuth } = useAuthStore()
  const router = useRouter()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // accessToken은 메모리 전용 — 리로드 시 httpOnly 쿠키로 재발급 시도
    const init = async () => {
      if (!accessToken) {
        try {
          const { data } = await axios.post<{ accessToken: string; memberId: number }>(
            '/api/v1/auth/refresh',
            undefined,
            { withCredentials: true }
          )
          setAuth(data.accessToken, data.memberId)
        } catch {
          clearAuth()
        }
      }
      setHydrated(true)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!accessToken || !memberId) {
      router.replace('/login')
    }
  }, [hydrated, accessToken, memberId, router])

  if (!hydrated) return null
  if (!accessToken || !memberId) return null

  return <>{children}</>
}
