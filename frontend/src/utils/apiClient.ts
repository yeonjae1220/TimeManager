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

    const newToken = await refreshAuth()

    if (!newToken) {
      if (typeof window !== 'undefined') window.location.href = '/login'
      return Promise.reject(error)
    }

    originalRequest.headers['Authorization'] = `Bearer ${newToken}`
    return apiClient(originalRequest)
  }
)

export default apiClient
