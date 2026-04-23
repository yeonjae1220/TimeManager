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
          <input v-model="password" type="password" autocomplete="new-password" placeholder="••••••••" @focus="passwordFocused = true" />
          <ul v-if="passwordFocused || password.length > 0" class="pwd-conditions">
            <li v-for="cond in PASSWORD_CONDITIONS" :key="cond.label" :class="{ met: cond.test(password) }">
              <span>{{ cond.test(password) ? '✓' : '○' }}</span>{{ cond.label }}
            </li>
          </ul>
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

const PASSWORD_CONDITIONS = [
  { label: '8자 이상',    test: (p) => p.length >= 8 },
  { label: '대문자 포함', test: (p) => /[A-Z]/.test(p) },
  { label: '소문자 포함', test: (p) => /[a-z]/.test(p) },
  { label: '숫자 포함',   test: (p) => /\d/.test(p) },
]

const { register } = useAuth();

const name = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);
const passwordFocused = ref(false);

async function handleRegister() {
  error.value = '';
  const unmet = PASSWORD_CONDITIONS.filter(c => !c.test(password.value))
  if (unmet.length > 0) {
    error.value = `비밀번호 조건 미충족: ${unmet.map(c => c.label).join(', ')}`
    return
  }
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

.pwd-conditions {
  list-style: none;
  padding: 6px 0 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pwd-conditions li {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-2, #9ca3af);
  transition: color 0.15s;
}
.pwd-conditions li.met { color: var(--accent, #16a34a); }
</style>
