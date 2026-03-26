<template>
  <div class="page auth-page">
    <div class="topbar">
      <span class="topbar-brand">timemgr</span>
    </div>

    <div class="auth-body">
      <div class="auth-hero">
        <p class="auth-eyebrow">sign in</p>
        <h1 class="auth-title">Welcome<br>back.</h1>
      </div>

      <form class="auth-form" @submit.prevent="handleLogin">
        <div class="field">
          <label>Email</label>
          <input v-model="email" type="email" autocomplete="email" placeholder="you@example.com" />
        </div>

        <div class="field">
          <label>Password</label>
          <input v-model="password" type="password" autocomplete="current-password" placeholder="••••••••" />
        </div>

        <p v-if="error" class="auth-error">{{ error }}</p>

        <button class="btn btn-primary" type="submit" :disabled="loading">
          <span v-if="loading">...</span>
          <span v-else>Sign in</span>
          <svg v-if="!loading" width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2.5 6.5h8M7 3l3.5 3.5L7 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </form>

      <div class="auth-divider">
        <span>or</span>
      </div>

      <button class="btn btn-google" type="button" @click="handleGoogleLogin">
        <svg width="16" height="16" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        Continue with Google
      </button>

      <p class="auth-switch">
        Don't have an account?
        <router-link to="/register" class="auth-link">Register</router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAuth } from '@/composables/useAuth';

const { login } = useAuth();

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleLogin() {
  error.value = '';
  loading.value = true;
  try {
    await login(email.value, password.value);
  } catch (e) {
    error.value = e.response?.data?.message || '로그인에 실패했습니다';
  } finally {
    loading.value = false;
  }
}

function handleGoogleLogin() {
  const clientId = process.env.VUE_APP_GOOGLE_CLIENT_ID;
  const redirectUri = `${window.location.origin}/oauth/callback`;
  const params = new URLSearchParams({
    client_id: clientId ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
</script>

<style scoped>
.auth-page { position: relative; }

.auth-body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: calc(100vh - 52px);
  max-width: 320px;
  padding-bottom: 60px;
}

.auth-hero { margin-bottom: 48px; }

.auth-eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--accent);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.auth-eyebrow::before {
  content: '';
  display: inline-block;
  width: 24px;
  height: 1px;
  background: var(--accent);
  opacity: 0.5;
}

.auth-title {
  font-family: var(--font-serif);
  font-size: clamp(36px, 6vw, 56px);
  line-height: 1.08;
  color: var(--text);
  letter-spacing: -0.01em;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 28px;
  margin-bottom: 32px;
}

.auth-error {
  font-size: 12px;
  color: var(--danger);
  font-family: var(--font-mono);
}

.auth-switch {
  font-size: 12px;
  color: var(--text-2);
}

.auth-link {
  color: var(--accent);
  transition: opacity var(--t);
}
.auth-link:hover { opacity: 0.7; }

.auth-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 4px 0;
  color: var(--text-2);
  font-size: 11px;
  font-family: var(--font-mono);
  letter-spacing: 0.05em;
}
.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border, #e5e7eb);
}

.btn-google {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border, #d1d5db);
  font-size: 13px;
  font-weight: 500;
  transition: border-color var(--t), opacity var(--t);
}
.btn-google:hover { border-color: var(--accent); opacity: 0.85; }
</style>
