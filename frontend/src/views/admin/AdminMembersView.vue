<template>
  <div class="page">
    <div class="topbar">
      <router-link to="/" class="topbar-brand">timemgr <span class="admin-badge">admin</span></router-link>
      <nav class="admin-nav">
        <router-link to="/admin">Dashboard</router-link>
        <router-link to="/admin/members">Members</router-link>
        <router-link :to="`/members/${authStore.memberId}/tags`">App</router-link>
      </nav>
    </div>

    <div class="admin-body">
      <div class="admin-header">
        <p class="eyebrow">management</p>
        <h1 class="title">Members</h1>
      </div>

      <div v-if="loading" class="loading">Loading...</div>

      <div v-else>
        <table class="member-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Provider</th>
              <th>Role</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="member in members" :key="member.id">
              <td class="mono">{{ member.id }}</td>
              <td>{{ member.name }}</td>
              <td>{{ member.email }}</td>
              <td class="mono">{{ member.provider }}</td>
              <td>
                <span :class="['role-badge', member.role === 'ADMIN' ? 'role-admin' : 'role-member']">
                  {{ member.role }}
                </span>
              </td>
              <td>
                <button
                  class="btn-toggle"
                  :disabled="updatingId === member.id"
                  @click="toggleRole(member)"
                >
                  {{ member.role === 'ADMIN' ? '→ MEMBER' : '→ ADMIN' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="pagination">
          <button class="btn-page" :disabled="page === 0" @click="page--; loadMembers()">←</button>
          <span class="page-info mono">{{ page + 1 }} / {{ totalPages }}</span>
          <button class="btn-page" :disabled="page >= totalPages - 1" @click="page++; loadMembers()">→</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { adminApi } from '@/api/admin';
import { useAuthStore } from '@/stores/authStore';

const authStore = useAuthStore();

const members = ref([]);
const loading = ref(true);
const page = ref(0);
const totalPages = ref(1);
const updatingId = ref(null);

async function loadMembers() {
  loading.value = true;
  try {
    const res = await adminApi.getMembers(page.value);
    members.value = res.data.content;
    totalPages.value = res.data.totalPages || 1;
  } catch (e) {
    console.error('Failed to load members', e);
  } finally {
    loading.value = false;
  }
}

async function toggleRole(member) {
  const newRole = member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN';
  updatingId.value = member.id;
  try {
    await adminApi.updateMemberRole(member.id, newRole);
    member.role = newRole;
  } catch (e) {
    console.error('Failed to update role', e);
  } finally {
    updatingId.value = null;
  }
}

onMounted(loadMembers);
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
  max-width: 900px;
  padding: 48px 24px;
}

.admin-header {
  margin-bottom: 32px;
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

.loading {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-2);
}

.member-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.member-table th {
  text-align: left;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-2);
  padding: 8px 12px;
  border-bottom: 1px solid var(--border, #e5e7eb);
}

.member-table td {
  padding: 12px;
  border-bottom: 1px solid var(--border, #e5e7eb);
  color: var(--text);
}

.mono {
  font-family: var(--font-mono);
  font-size: 12px;
}

.role-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.role-admin {
  background: rgba(var(--accent-rgb, 99, 102, 241), 0.1);
  color: var(--accent);
}

.role-member {
  background: var(--border, #e5e7eb);
  color: var(--text-2);
}

.btn-toggle {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 4px 10px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 4px;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  transition: border-color var(--t), color var(--t);
}

.btn-toggle:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.btn-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
}

.btn-page {
  font-family: var(--font-mono);
  font-size: 14px;
  padding: 6px 14px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 4px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition: border-color var(--t);
}

.btn-page:hover:not(:disabled) {
  border-color: var(--accent);
}

.btn-page:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 12px;
  color: var(--text-2);
}
</style>
