import apiClient from '@/utils/apiClient';

export const memberApi = {
    getProfile: (memberId) =>
        apiClient.get(`/api/v1/members/${memberId}`),
    updateProfile: (memberId, data) =>
        apiClient.put(`/api/v1/members/${memberId}`, data),
    deleteMember: (memberId) =>
        apiClient.delete(`/api/v1/members/${memberId}`),
};
