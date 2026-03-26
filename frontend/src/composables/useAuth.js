import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'vue-router';
import { authApi } from '@/api/auth';

export function useAuth() {
    const authStore = useAuthStore();
    const router = useRouter();

    async function login(email, password) {
        const response = await authApi.login(email, password);
        const { accessToken, refreshToken, memberId } = response.data;
        authStore.setAuth({ accessToken, refreshToken, memberId });
        await router.push(`/members/${memberId}/tags`);
    }

    async function logout() {
        if (authStore.refreshToken) {
            await authApi.logout(authStore.refreshToken).catch(() => {});
        }
        authStore.clearAuth();
        await router.push('/login');
    }

    async function register(name, email, password) {
        await authApi.register(name, email, password);
        await router.push('/login');
    }

    async function googleLogin(code, redirectUri) {
        const response = await authApi.googleLogin(code, redirectUri);
        const { accessToken, refreshToken, memberId } = response.data;
        authStore.setAuth({ accessToken, refreshToken, memberId });
        await router.push(`/members/${memberId}/tags`);
    }

    return { login, logout, register, googleLogin };
}
