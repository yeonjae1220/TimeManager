<template>
  <div class="page home-page">
    <div class="topbar">
      <span class="topbar-brand">timemgr</span>
    </div>

    <div class="home-body">
      <div class="home-hero">
        <p class="home-eyebrow">time tracking</p>
        <h1 class="home-title">Every second<br>accounted for.</h1>
        <p class="home-desc">
          A focused workspace for tracking what matters.<br>
          Start, stop, and review your time with precision.
        </p>
      </div>

      <div class="home-cta">
        <button class="btn btn-primary" @click="goTagsPage">
          Open workspace
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2.5 6.5h8M7 3l3.5 3.5L7 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <footer class="home-footer">
        <span class="mono">v0.1</span>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const router = useRouter();
const authStore = useAuthStore();
const goTagsPage = () => router.push(`/api/tag/${authStore.memberId}`);
</script>

<style scoped>
.home-page { position: relative; }

.home-body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: calc(100vh - 52px);
  padding-bottom: 60px;
}

.home-hero { margin-bottom: 48px; }

.home-eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--accent);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.home-eyebrow::before {
  content: '';
  display: inline-block;
  width: 24px;
  height: 1px;
  background: var(--accent);
  opacity: 0.5;
}

.home-title {
  font-family: var(--font-serif);
  font-size: clamp(42px, 7vw, 68px);
  line-height: 1.08;
  color: var(--text);
  margin-bottom: 24px;
  letter-spacing: -0.01em;
}

.home-desc {
  font-size: 14px;
  color: var(--text-2);
  line-height: 1.8;
  font-weight: 300;
  max-width: 340px;
}

.home-cta { margin-bottom: auto; }

.home-footer {
  position: absolute;
  bottom: 32px;
  right: 40px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-3);
  letter-spacing: 0.1em;
}

.mono { font-family: var(--font-mono); }
</style>
