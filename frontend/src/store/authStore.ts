'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

function extractRoleFromToken(token: string): string {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64))
    return payload?.role ?? 'MEMBER'
  } catch {
    return 'MEMBER'
  }
}

interface AuthState {
  accessToken: string | null
  memberId: number | null
  role: string | null
  setAuth: (accessToken: string, memberId: number) => void
  setAccessToken: (token: string) => void
  clearAuth: () => void
}

export const isAuthenticated = (s: AuthState) => !!s.accessToken
export const isAdmin = (s: AuthState) => s.role === 'ADMIN'

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      memberId: null,
      role: null,

      setAuth: (accessToken, memberId) =>
        set({ accessToken, memberId, role: extractRoleFromToken(accessToken) }),

      setAccessToken: (token) =>
        set({ accessToken: token, role: extractRoleFromToken(token) }),

      clearAuth: () =>
        set({ accessToken: null, memberId: null, role: null }),
    }),
    {
      name: 'timemgr-auth',
      version: 2,
      // accessToken, role은 XSS 탈취 위험으로 localStorage 제외 — 메모리에만 유지
      // 페이지 리로드 시 httpOnly 쿠키의 refresh token으로 재발급
      migrate: () => ({ accessToken: null, memberId: null, role: null }),
      partialize: (state) => ({
        memberId: state.memberId,
      }),
    }
  )
)
