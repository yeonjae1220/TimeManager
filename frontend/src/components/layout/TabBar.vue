<template>
  <nav class="tab-bar" :class="{ 'tab-bar--running': isRunning }">
    <div class="tab-bar--running-line" v-if="isRunning"></div>
    <router-link :to="`/members/${memberId}/today`" class="tab" :class="{ 'tab--active': isToday }">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="3.5" stroke="currentColor" stroke-width="1.3"/>
        <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.1 4.1l1.4 1.4M12.5 12.5l1.4 1.4M4.1 13.9l1.4-1.4M12.5 5.5l1.4-1.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      </svg>
      <span class="tab-label">Today</span>
    </router-link>
    <router-link :to="`/members/${memberId}/tags`" class="tab" :class="{ 'tab--active': isTags }">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M3 5h12M3 9h8M3 13h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      </svg>
      <span class="tab-label">Tags</span>
    </router-link>
    <router-link to="/logs" class="tab" :class="{ 'tab--active': isLogs }">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="3" y="3" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
        <path d="M6 7h6M6 10h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      </svg>
      <span class="tab-label">Logs</span>
    </router-link>
    <router-link to="/profile" class="tab" :class="{ 'tab--active': isProfile }">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="6.5" r="2.5" stroke="currentColor" stroke-width="1.3"/>
        <path d="M3.5 14.5c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      </svg>
      <span class="tab-label">Profile</span>
    </router-link>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const route = useRoute();
const authStore = useAuthStore();
const memberId = computed(() => authStore.memberId);

const isToday   = computed(() => route.path.includes('/today'));
const isTags    = computed(() => route.path.includes('/tags'));
const isLogs    = computed(() => route.path === '/logs');
const isProfile = computed(() => route.path === '/profile');

defineProps({
  isRunning: { type: Boolean, default: false },
});
</script>

<style scoped>
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: stretch;
  background: var(--bg);
  border-top: 1px solid var(--border-subtle);
  z-index: 200;
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-bar--running-line {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: var(--running);
  box-shadow: 0 0 12px var(--running);
  animation: scan-tab 3s ease infinite;
}

@keyframes scan-tab {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px 0 8px;
  color: var(--text-3);
  text-decoration: none;
  transition: color var(--t);
}

.tab:hover { color: var(--text-2); }

.tab--active { color: var(--accent); }

.tab-label {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
</style>
