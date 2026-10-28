'use client'

import axios, { type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/authStore'
import { refreshAuth, waitForPendingRefresh } from '@/utils/refreshAuth'
import { reportReachable, reportUnreachable } from '@/utils/connectivity'
import { isWriteMethod, trackWriteEnd, trackWriteStart } from '@/utils/inflightWrites'

// 응답이 영영 오지 않으면(네트워크 hang) 이 프라미스는 resolve도 reject도 되지
// 않는다. useAsyncData는 fail()이 불려야만 failed를 세우므로, 그런 요청은
// 재시도 수단도 없이 스피너가 영원히 도는 화면이 된다. 타임아웃을 걸어 hang을
// 명시적 실패(ECONNABORTED)로 바꿔 기존 실패 처리 경로(LoadError→reload)를 태운다.
const REQUEST_TIMEOUT_MS = 15_000

const apiClient = axios.create({
  baseURL: '',
  withCredentials: true,
  timeout: REQUEST_TIMEOUT_MS,
})

const AUTH_PATH_PREFIX = '/api/v1/auth/'

/**
 * 진행 중인 refresh 를 요청이 기다리는 상한. 이 대기는 axios timeout 이 시작되기 전이라
 * 그 15초에 포함되지 않는다 — 상한이 없으면 나쁜 망에서 refresh 재시도 사슬 전체
 * (수십 초) 동안 화면 요청과 타이머 조작이 실패 처리·오프라인 큐로 가지도 못한다.
 * 상한을 넘기면 토큰 없이 보내고, 401 이 오면 기존 경로가 같은 refresh 를 다시 기다린다.
 */
export const PENDING_REFRESH_WAIT_MS = 4_000

/** 이 요청 시도가 진행 중인 쓰기로 세어져 있는지. 401 재요청은 새 시도로 다시 센다. */
type TrackedConfig = InternalAxiosRequestConfig & { _writeTracked?: boolean }

function endWriteTracking(config: TrackedConfig | undefined) {
  if (!config?._writeTracked) return
  config._writeTracked = false
  trackWriteEnd()
}

apiClient.interceptors.request.use(async (config: TrackedConfig) => {
  let token = useAuthStore.getState().accessToken

  // 콜드 스타트에서는 화면을 refresh 보다 먼저 연다. 그 화면의 첫 요청들이 토큰 없이
  // 나가면 전부 401 → refresh 대기 → 재요청으로 왕복이 두 배가 되므로, 이미 진행 중인
  // refresh 가 있으면 그 결과를 (상한까지) 기다렸다가 토큰을 싣는다. 실패(offline·unauthenticated)
  // 여도 요청은 그대로 보낸다 — 판단은 기존 401 경로가 한다.
  // 인증 엔드포인트(login·logout 등)는 refresh 와 무관하므로 기다리지 않는다.
  if (!token && !config.url?.startsWith(AUTH_PATH_PREFIX)) {
    const result = await waitForPendingRefresh(PENDING_REFRESH_WAIT_MS)
    if (result?.status === 'authenticated') token = result.token
  }

  if (token) config.headers['Authorization'] = `Bearer ${token}`

  // 이 뒤로는 던질 곳이 없을 때 센다 — 인터셉터가 실패하면 응답 인터셉터에 config 가
  // 오지 않아 영영 해소되지 않는다. 위의 refresh 대기 동안은 getPendingRefresh() 가
  // 진행 중이라 새로고침 쪽이 이미 기다린다.
  if (isWriteMethod(config.method)) {
    config._writeTracked = true
    trackWriteStart()
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => {
    endWriteTracking(response.config)
    reportReachable()
    return response
  },
  async (error) => {
    const originalRequest = error.config
    endWriteTracking(originalRequest)

    // 연결 상태 판단의 1차 신호. 응답이 있으면(4xx·5xx 포함) 서버에는 닿은 것이고,
    // 응답 자체가 없으면 네트워크가 끊긴 것이다 — navigator.onLine 은 네이티브
    // WebView 에서 믿을 수 없으므로 실제 왕복 결과로 판단한다.
    if (error.response) reportReachable()
    else if (error.code !== 'ERR_CANCELED') reportUnreachable()

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    const result = await refreshAuth()

    if (result.status === 'authenticated') {
      originalRequest.headers['Authorization'] = `Bearer ${result.token}`
      return apiClient(originalRequest)
    }

    // 인증 확정 실패만 로그인으로 보낸다. offline(일시 장애)은
    // 리다이렉트 없이 원 에러를 전파해 세션을 유지한다.
    if (result.status === 'unauthenticated') {
      if (typeof window !== 'undefined') window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default apiClient
