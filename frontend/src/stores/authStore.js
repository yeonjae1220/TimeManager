import { defineStore } from 'pinia';
import { useTagStore } from '@/stores/tagStore';
import { extractRoleFromToken } from '@/utils/jwt';

export const useAuthStore = defineStore('auth', {
    state: () => ({
        accessToken: null,
        refreshToken: null,
        memberId: null,
        role: null,
    }),
    getters: {
        isAuthenticated: (state) => !!state.accessToken,
        isAdmin: (state) => state.role === 'ADMIN',
    },
    actions: {
        setAuth({ accessToken, refreshToken, memberId }) {
            this.accessToken = accessToken;
            this.refreshToken = refreshToken;
            this.memberId = memberId;
            this.role = extractRoleFromToken(accessToken);
        },
        setAccessToken(accessToken) {
            this.accessToken = accessToken;
            this.role = extractRoleFromToken(accessToken);
        },
        clearAuth() {
            this.accessToken = null;
            this.refreshToken = null;
            this.memberId = null;
            this.role = null;
            const tagStore = useTagStore();
            tagStore.clearCache();
        },
    },
    persist: true,
});
