import apiClient from '@/utils/apiClient';

export const adminApi = {
    getMembers: (page = 0, size = 20) =>
        apiClient.get('/api/v1/admin/members', { params: { page, size, sort: 'id,desc' } }),
    updateMemberRole: (memberId, role) =>
        apiClient.patch(`/api/v1/admin/members/${memberId}/role`, { role }),
    getStats: () =>
        apiClient.get('/api/v1/admin/stats'),
};
