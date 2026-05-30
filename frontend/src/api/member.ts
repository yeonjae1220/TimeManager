import apiClient from '@/utils/apiClient'

export interface Member {
  id: number
  name: string
  email: string
  role: string
}

export const memberApi = {
  getProfile: (memberId: number) =>
    apiClient.get<Member>(`/api/v1/members/${memberId}`),

  updateProfile: (memberId: number, data: Partial<Member>) =>
    apiClient.put<Member>(`/api/v1/members/${memberId}`, data),

  deleteMember: (memberId: number) =>
    apiClient.delete(`/api/v1/members/${memberId}`),
}
