<template>
  <div class="page landing-page">
    <div class="topbar">
      <span class="topbar-brand">timemgr</span>
      <div class="topbar-actions">
        <router-link to="/login" class="btn btn-ghost topbar-btn">Sign in</router-link>
        <router-link to="/register" class="btn btn-primary topbar-btn">Get started</router-link>
      </div>
    </div>

    <div class="landing-body">
      <div class="landing-hero">
        <p class="landing-eyebrow">time tracking</p>
        <h1 class="landing-title">Every second<br>accounted for.</h1>
        <p class="landing-desc">
          A focused workspace for tracking what matters.<br>
          Start, stop, and review your time with precision.
        </p>
      </div>

      <div class="landing-cta">
        <router-link to="/register" class="btn btn-primary landing-cta-btn">
          Get started — it's free
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2.5 6.5h8M7 3l3.5 3.5L7 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </router-link>
        <router-link to="/login" class="landing-signin-link mono">
          Already have an account? Sign in
        </router-link>
      </div>

      <div class="landing-features">
        <div class="feature-item">
          <span class="feature-dot"></span>
          <div>
            <p class="feature-title">Hierarchical tags</p>
            <p class="feature-desc">Organize your work into nested tags. Track time at any level.</p>
          </div>
        </div>
        <div class="feature-item">
          <span class="feature-dot"></span>
          <div>
            <p class="feature-title">Precise stopwatch</p>
            <p class="feature-desc">Session, daily, and lifetime totals — always up to date.</p>
          </div>
        </div>
        <div class="feature-item">
          <span class="feature-dot"></span>
          <div>
            <p class="feature-title">Full history</p>
            <p class="feature-desc">Browse and edit every record. Nothing is lost.</p>
          </div>
        </div>
      </div>

      <footer class="landing-footer">
        <span class="mono">timemgr · v0.1</span>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const router = useRouter();
const authStore = useAuthStore();

onMounted(() => {
  if (authStore.isAuthenticated && authStore.memberId) {
    router.replace(`/members/${authStore.memberId}/tags`);
  }
});
</script>

<style scoped>
.landing-page { position: relative; }

.topbar-actions { display: flex; gap: 8px; align-items: center; }

.topbar-btn {
  height: 28px;
  padding: 0 12px;
  font-size: 11px;
  font-family: var(--font-mono);
  letter-spacing: 0.06em;
}

.landing-body {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 52px);
  padding-bottom: 60px;
}

/* Hero */
.landing-hero { margin: 80px 0 48px; }

.landing-eyebrow {
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

.landing-eyebrow::before {
  content: '';
  display: inline-block;
  width: 24px;
  height: 1px;
  background: var(--accent);
  opacity: 0.5;
}

.landing-title {
  font-family: var(--font-serif);
  font-size: clamp(42px, 7vw, 68px);
  line-height: 1.08;
  color: var(--text);
  margin-bottom: 24px;
  letter-spacing: -0.01em;
}

.landing-desc {
  font-size: 14px;
  color: var(--text-2);
  line-height: 1.8;
  font-weight: 300;
  max-width: 340px;
}

/* CTA */
.landing-cta {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 64px;
  flex-wrap: wrap;
}

.landing-cta-btn {
  height: 40px;
  padding: 0 24px;
  font-size: 13px;
}

.landing-signin-link {
  font-size: 11px;
  color: var(--text-2);
  letter-spacing: 0.04em;
  transition: color var(--t);
}

.landing-signin-link:hover { color: var(--text); }

/* Features */
.landing-features {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-top: 1px solid var(--border-subtle);
  margin-bottom: auto;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 24px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.feature-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  opacity: 0.5;
  flex-shrink: 0;
  margin-top: 8px;
}

.feature-title {
  font-size: 13px;
  color: var(--text);
  margin-bottom: 4px;
  font-weight: 500;
}

.feature-desc {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.6;
}

/* Footer */
.landing-footer {
  padding-top: 48px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-3);
  letter-spacing: 0.1em;
}

.mono { font-family: var(--font-mono); }
</style>
