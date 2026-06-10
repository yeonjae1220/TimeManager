'use client'

import axios from 'axios'
import { useAuthStore } from '@/store/authStore'
import { refreshAuth } from '@/utils/refreshAuth'

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
  (response) => response,
  async (error) => {
    const originalRequest = error.config

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
