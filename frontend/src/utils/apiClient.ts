'use client'

import axios from 'axios'
import { useAuthStore } from '@/store/authStore'
import { refreshAuth } from '@/utils/refreshAuth'
import { reportReachable, reportUnreachable } from '@/utils/connectivity'

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

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (response) => {
    reportReachable()
    return response
  },
  async (error) => {
    const originalRequest = error.config

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
