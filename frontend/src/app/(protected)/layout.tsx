'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { accessToken, memberId } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!accessToken || !memberId) {
      router.replace('/login')
    }
  }, [accessToken, memberId, router])

  if (!accessToken || !memberId) return null

  return <>{children}</>
}
