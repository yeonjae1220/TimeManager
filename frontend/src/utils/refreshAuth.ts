'use client'

import axios from 'axios'
import { reportReachable, reportUnreachable } from '@/utils/connectivity'
import { useAuthStore } from '@/store/authStore'

/**
 * refresh 결과 — 호출부가 "재로그인 필요"와 "일시적 실패"를 구분할 수 있게 한다.
 * - authenticated: 새 accessToken 발급 성공
 * - unauthenticated: 서버가 인증을 확정 거부 (400 죽은 토큰 / 401 쿠키 없음)
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
 * 시도 하나의 상한. 응답이 영영 오지 않는 망(lie-fi)에서 timeout 이 없으면 이
 * 프라미스가 끝나지 않아, 그걸 기다리는 랜딩 스플래시·보호 레이아웃 스켈레톤이
 * 영원히 멈춘다. 초과는 응답 없는 실패(retryable)로 분류돼 재시도·offline 경로를 탄다.
 *
 * ⚠️ 짧게 줄이지 말 것. 서버는 회전할 때 옛 토큰을 바로 지운다 — 느리지만 살아 있는
 * 회전 응답을 여기서 끊으면 새 쿠키를 못 받은 채 다음 시도가 옛 쿠키로 400 을 받아
 * 강제 로그아웃된다. 낙관적 진입 덕에 화면은 이 값을 기다리지 않으므로 넉넉해도 된다.
 */
export const REFRESH_TIMEOUT_MS = 20_000

/**
 * 백엔드 계약 (AuthApiController + GlobalExceptionHandler):
 * - 400: 유효하지 않은/만료된 refresh token (죽은 토큰)
 * - 401: refresh 쿠키 자체가 없음
 * - 429: rate limit 초과
 * - 응답 없음(네트워크/타임아웃) 또는 5xx: 일시 장애
 *
 * 그 밖의 4xx(403·404 등)는 백엔드가 이 엔드포인트에서 내지 않는다 — Cloudflare·
 * nginx 같은 중간 계층이 만든 응답이라 세션의 생사를 말해주지 않는다. 이걸 로그아웃
 * 근거로 삼으면 중간 계층의 일시 장애 한 번에 세션(과 오프라인 사용)이 날아간다.
 */
export function classifyRefreshError(error: unknown): RefreshErrorKind {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    if (status === undefined) return 'retryable' // 네트워크 에러·타임아웃·무응답
    if (status === 429) return 'rate-limited'
    if (status === 400 || status === 401) return 'unauthenticated'
    // 408·5xx 및 백엔드가 내지 않는 그 밖의 4xx → 일시 장애로 보고 재시도
    return 'retryable'
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
  // 이 refresh 가 시작된 세션 세대. 도중에 로그아웃(clearAuth)되면 세대가 바뀐다 —
  // 낙관적 진입으로 refresh 가 끝나기 전에도 사용자가 로그아웃할 수 있게 됐으므로,
  // 늦게 온 성공이 지운 세션을 되살리지 않게 막는다.
  const epoch = useAuthStore.getState().sessionEpoch
  const loggedOutMeanwhile = () => useAuthStore.getState().sessionEpoch !== epoch

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data } = await axios.post<{ accessToken: string; memberId: number }>(
        '/api/v1/auth/refresh',
        undefined,
        { withCredentials: true, timeout: REFRESH_TIMEOUT_MS },
      )
      if (loggedOutMeanwhile()) return { status: 'unauthenticated' }
      useAuthStore.getState().setAuth(data.accessToken, data.memberId)
      reportReachable()
      return { status: 'authenticated', token: data.accessToken }
    } catch (error) {
      const kind = classifyRefreshError(error)

      // 이 모듈은 apiClient 를 거치지 않고 axios 를 직접 쓴다(인터셉터 재귀를 피하려고).
      // 그래서 연결 상태 보고도 여기서 직접 해야 한다 — 빠뜨리면 콜드 스타트처럼
      // refresh 가 첫 실패인 상황에서 오프라인 배너가 뜨지 않고 복귀 감지도 안 돈다.
      // 판정 규칙은 apiClient 와 같다: 응답이 있으면 도달, 응답 없는 네트워크 오류면
      // 미도달. 그 외(예상 밖의 JS 예외 등)는 연결 상태의 근거가 아니므로 보고하지 않는다.
      if (axios.isAxiosError(error)) {
        if (error.response) reportReachable()
        else if (error.code !== 'ERR_CANCELED') reportUnreachable()
      }

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
        if (loggedOutMeanwhile()) return { status: 'unauthenticated' }
        continue
      }
      return { status: 'offline' }
    }
  }
  return { status: 'offline' } // 도달 불가 — 타입 안전용
}

/**
 * 진행 중인 refresh 가 있으면 그 프라미스, 없으면 null.
 * apiClient 가 토큰 없이 요청을 보내 401 왕복을 만드는 대신 이 결과를 기다리는 데 쓴다.
 */
export function getPendingRefresh(): Promise<RefreshOutcome> | null {
  return pending
}

/** 마지막으로 끝난 refresh 의 결과와 그 시각. */
let lastSettled: { outcome: RefreshOutcome; at: number } | null = null

/**
 * maxMs 안에 끝난 refresh 의 결과. 진행 중인 refresh 가 있거나, 없었거나, 오래됐으면 null.
 *
 * 콜드 스타트에서 랜딩이 재시도 사슬을 다 돌고 offline 을 받은 직후 보호 레이아웃이
 * 마운트되면, 레이아웃이 같은 사슬을 처음부터 다시 돌며 그동안 스켈레톤으로 화면을
 * 막는다(응답 없는 망에선 시도당 최대 REFRESH_TIMEOUT_MS). 방금 받은 결과를 재사용해
 * 이를 막는다. 상한은 짧게 둔다 — 그 뒤의 재시도는 연결 복구 신호가 맡는다.
 */
export function getRecentRefreshOutcome(maxMs: number, now = Date.now()): RefreshOutcome | null {
  if (pending || !lastSettled) return null
  const age = now - lastSettled.at
  // 미래 시각(기기 시계가 뒤로 감)은 나이를 알 수 없으므로 믿지 않는다.
  return age >= 0 && age <= maxMs ? lastSettled.outcome : null
}

/**
 * 진행 중인 refresh 를 최대 maxMs 까지만 기다린다. 없거나 상한을 넘기면 null.
 * 상한을 넘겨도 refresh 자체는 계속 돈다 — 기다리는 쪽만 손을 뗀다.
 */
export async function waitForPendingRefresh(maxMs: number): Promise<RefreshOutcome | null> {
  const current = pending
  if (!current) return null
  let timer: ReturnType<typeof setTimeout> | undefined
  const giveUp = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), maxMs) })
  try {
    return await Promise.race([current, giveUp])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * refresh token 쿠키로 새 accessToken을 발급한다.
 * 동시 호출은 싱글톤 in-flight 프라미스를 공유해 stampede를 막는다.
 * 재시도(백오프)까지 같은 프라미스 안에서 처리되므로 중복 회전이 발생하지 않는다.
 */
export async function refreshAuth(): Promise<RefreshOutcome> {
  if (pending) return pending
  pending = attemptRefresh()
    .then((outcome) => {
      lastSettled = { outcome, at: Date.now() }
      return outcome
    })
    .finally(() => {
      pending = null
    })
  return pending
}
