'use client'

import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/auth'

export function useAuth() {
  const router = useRouter()
  const { setAuth, clearAuth } = useAuthStore()

  async function login(email: string, password: string) {
    const response = await authApi.login(email, password)
    const { accessToken, memberId } = response.data
    setAuth(accessToken, memberId)
    router.push(`/members/${memberId}/today`)
  }

  async function logout() {
    await authApi.logout().catch(() => {})
    clearAuth()
    router.push('/login')
  }

  async function register(name: string, email: string, password: string) {
    await authApi.register(name, email, password)
    router.push('/login')
  }

  async function googleLogin(code: string, redirectUri: string) {
    const response = await authApi.googleLogin(code, redirectUri)
    const { accessToken, memberId } = response.data
    setAuth(accessToken, memberId)
    router.push(`/members/${memberId}/today`)
  }

  return { login, logout, register, googleLogin }
}
