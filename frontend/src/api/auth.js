import apiClient from '@/utils/apiClient';

export const authApi = {
    login: (email, password) =>
        apiClient.post('/api/v1/auth/login', { email, password }),
    register: (name, email, password) =>
        apiClient.post('/api/v1/members', { name, email, password }),
    refresh: () =>
        apiClient.post('/api/v1/auth/refresh'),
    logout: () =>
        apiClient.post('/api/v1/auth/logout'),
    googleLogin: (code, redirectUri) =>
        apiClient.post('/api/v1/auth/google', { code, redirectUri }),
};
