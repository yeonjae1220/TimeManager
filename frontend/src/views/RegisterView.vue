<template>
  <div class="page auth-page">
    <div class="topbar">
      <span class="topbar-brand">timemgr</span>
    </div>

    <div class="auth-body">
      <div class="auth-hero">
        <p class="auth-eyebrow">create account</p>
        <h1 class="auth-title">Get<br>started.</h1>
      </div>

      <form class="auth-form" @submit.prevent="handleRegister">
        <div class="field">
          <label>Name</label>
          <input v-model="name" type="text" autocomplete="name" placeholder="Your name" />
        </div>

        <div class="field">
          <label>Email</label>
          <input v-model="email" type="email" autocomplete="email" placeholder="you@example.com" />
        </div>

        <div class="field">
          <label>Password</label>
          <input v-model="password" type="password" autocomplete="new-password" placeholder="••••••••" />
        </div>

        <p v-if="error" class="auth-error">{{ error }}</p>

        <button class="btn btn-primary" type="submit" :disabled="loading">
          <span v-if="loading">...</span>
          <span v-else>Create account</span>
          <svg v-if="!loading" width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2.5 6.5h8M7 3l3.5 3.5L7 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </form>

      <p class="auth-switch">
        Already have an account?
        <router-link to="/login" class="auth-link">Sign in</router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAuth } from '@/composables/useAuth';

const { register } = useAuth();

const name = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleRegister() {
  error.value = '';
  loading.value = true;
  try {
    await register(name.value, email.value, password.value);
  } catch (e) {
    error.value = e.response?.data?.message || '회원가입에 실패했습니다';
  } finally {
    loading.value = false;
  }
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
</style>
