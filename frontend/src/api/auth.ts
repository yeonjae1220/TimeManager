import apiClient from '@/utils/apiClient'

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<{ accessToken: string; memberId: number }>('/api/v1/auth/login', { email, password }),

  register: (name: string, email: string, password: string) =>
    apiClient.post('/api/v1/members', { name, email, password }),

  refresh: () =>
    apiClient.post<{ accessToken: string; memberId: number }>('/api/v1/auth/refresh'),

  logout: () =>
    apiClient.post('/api/v1/auth/logout'),

  googleLogin: (code: string, redirectUri: string) =>
    apiClient.post<{ accessToken: string; memberId: number }>('/api/v1/auth/google', { code, redirectUri }),
}
