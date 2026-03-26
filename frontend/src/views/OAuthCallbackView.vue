<template>
  <div class="callback-page">
    <div v-if="error" class="callback-error">
      <p class="error-msg">{{ error }}</p>
      <router-link to="/login" class="btn btn-primary">
        Back to Login
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M2.5 6.5h8M7 3l3.5 3.5L7 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </router-link>
    </div>
    <div v-else class="callback-loading">
      <div class="spinner" />
      <p class="loading-msg">Signing in...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';

const router = useRouter();
const { googleLogin } = useAuth();
const error = ref('');

onMounted(async () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const oauthError = params.get('error');

  if (oauthError || !code) {
    await router.replace('/login');
    return;
  }

  const redirectUri = `${window.location.origin}/oauth/callback`;
  try {
    await googleLogin(code, redirectUri);
  } catch (e) {
    error.value = e.response?.data?.message || 'Google 로그인에 실패했습니다. 다시 시도해주세요.';
  }
});
</script>

<style scoped>
.callback-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

.callback-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--border, #e5e7eb);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-msg {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--text-2);
  text-transform: uppercase;
}

.callback-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  text-align: center;
}

.error-msg {
  font-size: 13px;
  color: var(--danger);
  font-family: var(--font-mono);
}
</style>
