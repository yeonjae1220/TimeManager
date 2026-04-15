<template>
  <div class="page">
    <div class="topbar">
      <router-link to="/" class="topbar-brand">timemgr <span class="admin-badge">admin</span></router-link>
      <nav class="admin-nav">
        <router-link to="/admin/members">Members</router-link>
        <router-link :to="`/members/${authStore.memberId}/tags`">App</router-link>
      </nav>
    </div>

    <div class="admin-body">
      <div class="admin-header">
        <p class="eyebrow">dashboard</p>
        <h1 class="title">Overview</h1>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <p class="stat-label">Total Members</p>
          <p class="stat-value">{{ stats?.totalMembers ?? '—' }}</p>
        </div>
      </div>

      <div class="quick-links">
        <router-link to="/admin/members" class="btn btn-primary">Manage Members →</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { adminApi } from '@/api/admin';
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();
const stats = ref(null);

onMounted(async () => {
  try {
    const res = await adminApi.getStats();
    stats.value = res.data;
  } catch (e) {
    console.error('Failed to load stats', e);
  }
});
</script>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 52px;
  border-bottom: 1px solid var(--border, #e5e7eb);
}

.topbar-brand {
  text-decoration: none;
  color: var(--text);
  font-weight: 600;
  font-size: 14px;
  transition: opacity var(--t);
}
.topbar-brand:hover { opacity: 0.7; }

.admin-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--accent);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-left: 6px;
}

.admin-nav {
  display: flex;
  gap: 20px;
  font-size: 13px;
}

.admin-nav a {
  color: var(--text-2);
  text-decoration: none;
  transition: color var(--t);
}

.admin-nav a:hover,
.admin-nav a.router-link-active {
  color: var(--text);
}

.admin-body {
  max-width: 800px;
  padding: 48px 24px;
}

.admin-header {
  margin-bottom: 40px;
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--accent);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.title {
  font-family: var(--font-serif);
  font-size: clamp(28px, 5vw, 48px);
  line-height: 1.1;
  color: var(--text);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
  margin-bottom: 40px;
}

.stat-card {
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 8px;
  padding: 20px;
}

.stat-label {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-2);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  color: var(--text);
}
</style>
