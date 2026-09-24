'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  accessToken: string | null
  memberId: number | null
  setAuth: (accessToken: string, memberId: number) => void
  setAccessToken: (token: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      memberId: null,

      setAuth: (accessToken, memberId) =>
        set({ accessToken, memberId }),

      setAccessToken: (token) =>
        set({ accessToken: token }),

      clearAuth: () =>
        set({ accessToken: null, memberId: null }),
    }),
    {
      name: 'timemgr-auth',
      version: 2,
      // accessToken은 XSS 탈취 위험으로 localStorage 제외 — 메모리에만 유지
      // 페이지 리로드 시 httpOnly 쿠키의 refresh token으로 재발급
      migrate: () => ({ accessToken: null, memberId: null }),
      partialize: (state) => ({
        memberId: state.memberId,
      }),
    }
  )
)
