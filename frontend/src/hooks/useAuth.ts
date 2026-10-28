'use client'

import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/auth'
import { syncNativeRunningSession } from '@/native/runningSession'
import { waitForPendingRefresh } from '@/utils/refreshAuth'

/**
 * 로그아웃이 진행 중인 refresh 를 기다리는 상한. 동시에 보내면 서버에서 refresh 의
 * 회전 저장이 로그아웃의 삭제 뒤에 일어나 세션이 되살아나고, 늦게 온 Set-Cookie 가
 * 방금 지운 쿠키를 다시 심는다. 상한을 넘기면 그냥 진행한다(로그아웃을 막지 않는다).
 */
const LOGOUT_REFRESH_WAIT_MS = 3_000

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
    await waitForPendingRefresh(LOGOUT_REFRESH_WAIT_MS)
    await authApi.logout().catch(() => {})

    // 예약된 로컬 알림과 실행중 표시는 **OS 가 들고 있다** — 앱 상태를 지운다고 사라지지
    // 않는다. 정리하지 않으면 로그아웃한 뒤에도 "3시간 되었습니다"가 튀어나오고,
    // 상태표시줄에는 남의 타이머가 계속 흐른다. 라우팅보다 먼저 끝낸다.
    await syncNativeRunningSession(null)

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
