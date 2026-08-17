'use client'

import axios from 'axios'
import { useAuthStore } from '@/store/authStore'
import { refreshAuth } from '@/utils/refreshAuth'
import { reportReachable, reportUnreachable } from '@/utils/connectivity'

const apiClient = axios.create({
  baseURL: '',
  withCredentials: true,
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
