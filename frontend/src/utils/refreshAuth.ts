'use client'

import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

/**
 * refresh 결과 — 호출부가 "재로그인 필요"와 "일시적 실패"를 구분할 수 있게 한다.
 * - authenticated: 새 accessToken 발급 성공
 * - unauthenticated: 서버가 인증을 확정 거부 (400 죽은 토큰 / 401 쿠키 없음 / 403)
 * - offline: 네트워크·서버 일시 장애 또는 rate limit. 세션은 유지하고 나중에 재시도.
 */
export type RefreshOutcome =
  | { status: 'authenticated'; token: string }
  | { status: 'unauthenticated' }
  | { status: 'offline' }

/**
 * 한 번의 refresh 시도가 실패했을 때의 분류.
 * - unauthenticated: 인증 확정 실패 → 재시도 무의미, 세션 정리
 * - retryable: 네트워크/타임아웃/5xx → 백오프 후 재시도
 * - rate-limited: 429 → 재시도하면 제한 버킷을 더 두드릴 뿐이므로 즉시 중단(세션 유지)
 */
export type RefreshErrorKind = 'unauthenticated' | 'retryable' | 'rate-limited'

const MAX_RETRIES = 3
const BASE_DELAY_MS = 400
const MAX_DELAY_MS = 2000

/**
 * 백엔드 계약 (AuthApiController + GlobalExceptionHandler):
 * - 400: 유효하지 않은/만료된 refresh token (죽은 토큰)
 * - 401: refresh 쿠키 자체가 없음
 * - 429: rate limit 초과
 * - 응답 없음(네트워크/타임아웃) 또는 5xx: 일시 장애
 */
export function classifyRefreshError(error: unknown): RefreshErrorKind {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    if (status === undefined) return 'retryable' // 네트워크 에러·타임아웃·무응답
    if (status === 429) return 'rate-limited'
    if (status === 408 || status >= 500) return 'retryable'
    // 400·401·403 및 기타 4xx → 인증 확정 실패로 보수적 처리
    return 'unauthenticated'
  }
  // 비-axios 예외(예상 밖)는 일시적 문제로 간주 — 재시도 횟수로 상한이 걸려 안전
  return 'retryable'
}

/** 지수 백오프 + 지터(0.5x~1x). 상한 MAX_DELAY_MS. */
export function backoffDelay(attempt: number): number {
  const exp = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS)
  return exp * (0.5 + Math.random() * 0.5)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

let pending: Promise<RefreshOutcome> | null = null

async function attemptRefresh(): Promise<RefreshOutcome> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data } = await axios.post<{ accessToken: string; memberId: number }>(
        '/api/v1/auth/refresh',
        undefined,
        { withCredentials: true },
      )
      useAuthStore.getState().setAuth(data.accessToken, data.memberId)
      return { status: 'authenticated', token: data.accessToken }
    } catch (error) {
      const kind = classifyRefreshError(error)

      if (kind === 'unauthenticated') {
        useAuthStore.getState().clearAuth()
        return { status: 'unauthenticated' }
      }

      // rate-limited: 더 두드리지 않고 세션 유지한 채 중단
      if (kind === 'rate-limited') {
        return { status: 'offline' }
      }

      // retryable: 남은 시도가 있으면 백오프 후 재시도, 소진 시 세션 유지한 채 offline
      if (attempt < MAX_RETRIES) {
        await sleep(backoffDelay(attempt))
        continue
      }
      return { status: 'offline' }
    }
  }
  return { status: 'offline' } // 도달 불가 — 타입 안전용
}

/**
 * refresh token 쿠키로 새 accessToken을 발급한다.
 * 동시 호출은 싱글톤 in-flight 프라미스를 공유해 stampede를 막는다.
 * 재시도(백오프)까지 같은 프라미스 안에서 처리되므로 중복 회전이 발생하지 않는다.
 */
export async function refreshAuth(): Promise<RefreshOutcome> {
  if (pending) return pending
  pending = attemptRefresh().finally(() => {
    pending = null
  })
  return pending
}
