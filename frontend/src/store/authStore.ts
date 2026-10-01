'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  accessToken: string | null
  memberId: number | null
  /** 이 기기에서 마지막으로 서버가 인증을 확인해 준 시각(ms). 콜드 스타트 낙관적 진입의 근거. */
  lastAuthOkAt: number | null
  /**
   * clearAuth 때마다 1씩 올라가는 세션 세대(저장하지 않음). 로그아웃 전에 시작된
   * refresh 의 늦은 성공이 지운 세션을 되살리지 않도록 refreshAuth 가 비교한다.
   */
  sessionEpoch: number
  setAuth: (accessToken: string, memberId: number) => void
  setAccessToken: (token: string) => void
  clearAuth: () => void
}

/**
 * 콜드 스타트에서 refresh 왕복을 기다리지 않고 화면을 먼저 여는 기간.
 *
 * 서버 refresh 세션은 30일 슬라이딩이지만, 만료 연장은 회전(24시간에 한 번) 때만
 * 일어난다. 그래서 마지막 성공이 직전 회전보다 최대 하루 늦을 수 있다 — 하루를 빼서
 * "열었다가 곧바로 로그인으로 튕기는" 경우가 이 창 안에서는 생기지 않게 한다.
 * (백엔드: jwt.refresh-token-ttl-minutes=43200, AUTH_ROTATION_INTERVAL_HOURS=24)
 */
export const OPTIMISTIC_SESSION_WINDOW_MS = 29 * 24 * 60 * 60 * 1000

/**
 * 이 기기의 세션 흔적만으로 화면을 먼저 열어도 되는가.
 *
 * ⚠️ 이 판정은 "기다릴지"만 정한다 — refresh 를 시도할지는 정하지 않는다(PIT-053).
 * false 여도 호출부는 그대로 refresh 를 시도하고, 그 결과로 판단한다.
 */
export function canOpenOptimistically(
  state: Pick<AuthState, 'memberId' | 'lastAuthOkAt'>,
  now: number,
): boolean {
  const { memberId, lastAuthOkAt } = state
  if (memberId === null || lastAuthOkAt === null) return false
  const age = now - lastAuthOkAt
  // 미래 시각(기기 시계가 뒤로 감)은 나이를 알 수 없으므로 믿지 않는다.
  return age >= 0 && age < OPTIMISTIC_SESSION_WINDOW_MS
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      memberId: null,
      lastAuthOkAt: null,
      sessionEpoch: 0,

      setAuth: (accessToken, memberId) =>
        set({ accessToken, memberId, lastAuthOkAt: Date.now() }),

      setAccessToken: (token) =>
        set({ accessToken: token }),

      clearAuth: () =>
        set((state) => ({
          accessToken: null,
          memberId: null,
          lastAuthOkAt: null,
          sessionEpoch: state.sessionEpoch + 1,
        })),
    }),
    {
      name: 'timemgr-auth',
      version: 2,
      // accessToken은 XSS 탈취 위험으로 localStorage 제외 — 메모리에만 유지
      // 페이지 리로드 시 httpOnly 쿠키의 refresh token으로 재발급
      migrate: () => ({ accessToken: null, memberId: null, lastAuthOkAt: null }),
      // lastAuthOkAt 은 버전을 올리지 않고 추가한다 — 올리면 migrate 가 memberId 까지
      // 지워 기존 사용자가 한 번 로그아웃된다. 기존 저장분에는 이 필드가 없어 null 로
      // 시작하고(낙관적 진입 대신 refresh 를 기다림), 다음 refresh 성공 때 채워진다.
      partialize: (state) => ({
        memberId: state.memberId,
        lastAuthOkAt: state.lastAuthOkAt,
      }),
    }
  )
)
