'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { accessToken, memberId } = useAuthStore()
  const router = useRouter()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
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
