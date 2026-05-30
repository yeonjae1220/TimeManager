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
  isAuthenticated: boolean
  isAdmin: boolean
  setAuth: (accessToken: string, memberId: number) => void
  setAccessToken: (token: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      memberId: null,
      role: null,
      get isAuthenticated() { return false },
      get isAdmin() { return false },

      setAuth: (accessToken, memberId) =>
        set({ accessToken, memberId, role: extractRoleFromToken(accessToken) }),

      setAccessToken: (token) =>
        set({ accessToken: token, role: extractRoleFromToken(token) }),

      clearAuth: () =>
        set({ accessToken: null, memberId: null, role: null }),
    }),
    {
      name: 'timemgr-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        memberId: state.memberId,
        role: state.role,
      }),
    }
  )
)
