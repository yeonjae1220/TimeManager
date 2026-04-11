import { defineStore } from 'pinia';
import { useTagStore } from '@/stores/tagStore';

export const useAuthStore = defineStore('auth', {
    state: () => ({
        accessToken: null,
        refreshToken: null,
        memberId: null,
    }),
    getters: {
        isAuthenticated: (state) => !!state.accessToken,
    },
    actions: {
        setAuth({ accessToken, refreshToken, memberId }) {
            this.accessToken = accessToken;
            this.refreshToken = refreshToken;
            this.memberId = memberId;
        },
        setAccessToken(accessToken) {
            this.accessToken = accessToken;
        },
        clearAuth() {
            this.accessToken = null;
            this.refreshToken = null;
            this.memberId = null;
            const tagStore = useTagStore();
            tagStore.clearCache();
        },
    },
    persist: true,
});
