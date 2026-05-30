'use client'

import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

let pending: Promise<string | null> | null = null

export async function refreshAuth(): Promise<string | null> {
  if (pending) return pending

  pending = axios
    .post<{ accessToken: string; memberId: number }>('/api/v1/auth/refresh', undefined, { withCredentials: true })
    .then(({ data }) => {
      useAuthStore.getState().setAuth(data.accessToken, data.memberId)
      return data.accessToken
    })
    .catch(() => {
      useAuthStore.getState().clearAuth()
      return null
    })
    .finally(() => {
      pending = null
    })

  return pending
}
