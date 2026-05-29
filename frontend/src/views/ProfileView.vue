<template>
  <AppShell>
  <div class="page profile-page">
    <div class="topbar">
      <span class="topbar-brand">timemgr</span>
    </div>

    <div v-if="loading" class="profile-body">
      <div class="profile-skeleton">
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line skeleton-sub"></div>
      </div>
    </div>

    <div v-else-if="profile" class="profile-body">
      <!-- Hero -->
      <div class="profile-hero">
        <p class="profile-eyebrow">account</p>
        <h1 class="profile-title">Your<br>profile.</h1>
      </div>

      <!-- Identity -->
      <div class="profile-section">
        <span class="profile-section-label">identity</span>
        <div class="identity-row">
          <div class="identity-name">{{ profile.name }}</div>
          <div class="identity-email">{{ profile.email }}</div>
          <span class="provider-badge" :class="profile.provider.toLowerCase()">
            {{ profile.provider === 'GOOGLE' ? 'Google account' : 'Local account' }}
          </span>
        </div>
      </div>

      <!-- Edit Name -->
      <div class="profile-section">
        <span class="profile-section-label">display name</span>
        <div class="field">
          <label>Name</label>
          <input
            v-model="editName"
            type="text"
            autocomplete="name"
            placeholder="Your name"
          />
        </div>
        <p v-if="nameError" class="form-error">{{ nameError }}</p>
        <p v-if="nameSuccess" class="form-success">Saved.</p>
        <div class="section-footer">
          <button
            class="btn btn-primary section-btn"
            :disabled="editName === profile.name || saving"
            @click="saveName"
          >
            <span v-if="saving">...</span>
            <span v-else>Save</span>
          </button>
        </div>
      </div>

      <!-- Change Password (LOCAL only) -->
      <div v-if="profile.provider === 'LOCAL'" class="profile-section">
        <span class="profile-section-label">password</span>
        <div class="password-fields">
          <div class="field">
            <label>Current password</label>
            <input v-model="pwForm.current" type="password" autocomplete="current-password" placeholder="••••••••" />
          </div>
          <div class="field">
            <label>New password</label>
            <input v-model="pwForm.next" type="password" autocomplete="new-password" placeholder="••••••••" />
          </div>
          <div class="field">
            <label>Confirm new password</label>
            <input v-model="pwForm.confirm" type="password" autocomplete="new-password" placeholder="••••••••" />
          </div>
        </div>
        <p v-if="pwError" class="form-error">{{ pwError }}</p>
        <p v-if="pwSuccess" class="form-success">Password updated.</p>
        <div class="section-footer">
          <button
            class="btn btn-primary section-btn"
            :disabled="!pwForm.current || !pwForm.next || !pwForm.confirm || pwSaving"
            @click="changePassword"
          >
            <span v-if="pwSaving">...</span>
            <span v-else>Update password</span>
          </button>
        </div>
      </div>

      <!-- Timer Settings -->
      <div class="profile-section">
        <span class="profile-section-label">timer settings</span>
        <div class="timer-settings-info">
          <p class="settings-desc">일일 타이머가 초기화되는 기준 시각을 설정합니다.</p>
        </div>
        <div class="field">
          <label>Timezone</label>
          <select v-model="timerSettings.timezone" class="settings-select">
            <option value="Asia/Seoul">Asia/Seoul (KST, UTC+9)</option>
            <option value="Asia/Tokyo">Asia/Tokyo (JST, UTC+9)</option>
            <option value="Asia/Shanghai">Asia/Shanghai (CST, UTC+8)</option>
            <option value="America/New_York">America/New_York (EST, UTC-5)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (PST, UTC-8)</option>
            <option value="Europe/London">Europe/London (GMT, UTC+0)</option>
            <option value="UTC">UTC</option>
          </select>
        </div>
        <div class="field">
          <label>Daily reset time</label>
          <select v-model.number="timerSettings.dailyResetHour" class="settings-select">
            <option v-for="h in 24" :key="h-1" :value="h-1">
              {{ String(h-1).padStart(2,'0') }}:00{{ h-1 === 0 ? ' (자정)' : h-1 === 5 ? ' (새벽 5시, 기본값)' : '' }}
            </option>
          </select>
        </div>
        <p v-if="timerError" class="form-error">{{ timerError }}</p>
        <p v-if="timerSuccess" class="form-success">Saved.</p>
        <div class="section-footer">
          <button
            class="btn btn-primary section-btn"
            :disabled="!timerSettingsChanged || timerSaving"
            @click="saveTimerSettings"
          >
            <span v-if="timerSaving">...</span>
            <span v-else>Save</span>
          </button>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="profile-section profile-danger">
        <span class="profile-section-label">danger zone</span>
        <div class="danger-actions">
          <button class="btn btn-danger" @click="handleLogout">Sign out</button>
          <button class="btn btn-danger" @click="showDeleteConfirm = true">회원 탈퇴</button>
        </div>
      </div>
    </div>

    <!-- Delete confirm modal -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="modal-panel">
        <div class="modal-header">
          <span class="modal-title">계정을 삭제하시겠습니까?</span>
          <button class="modal-close" @click="showDeleteConfirm = false">✕</button>
        </div>
        <p class="delete-warning">
          모든 태그와 기록이 영구적으로 삭제됩니다.<br>이 작업은 되돌릴 수 없습니다.
        </p>
        <p v-if="deleteError" class="form-error">{{ deleteError }}</p>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showDeleteConfirm = false">취소</button>
          <button class="btn btn-danger" :disabled="deleting" @click="handleDeleteAccount">
            <span v-if="deleting">...</span>
            <span v-else>탈퇴 확인</span>
          </button>
        </div>
      </div>
    </div>
  </div>
  </AppShell>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AppShell from '@/components/layout/AppShell.vue';
import { useAuthStore } from '@/stores/authStore';
import { useAuth } from '@/composables/useAuth';
import { memberApi } from '@/api/memberApi';

const router = useRouter();
const authStore = useAuthStore();
const { logout } = useAuth();

const profile = ref(null);
const loading = ref(true);
const editName = ref('');

const nameError = ref('');
const nameSuccess = ref(false);
const saving = ref(false);

const pwForm = reactive({ current: '', next: '', confirm: '' });
const pwError = ref('');
const pwSuccess = ref(false);
const pwSaving = ref(false);

const timerSettings = reactive({ timezone: 'Asia/Seoul', dailyResetHour: 5 });
const timerError = ref('');
const timerSuccess = ref(false);
const timerSaving = ref(false);

const timerSettingsChanged = computed(() =>
  profile.value &&
  (timerSettings.timezone !== profile.value.timezone ||
   timerSettings.dailyResetHour !== profile.value.dailyResetHour)
);

const showDeleteConfirm = ref(false);
const deleteError = ref('');
const deleting = ref(false);

async function loadProfile() {
  if (!authStore.memberId) {
    await router.push('/login');
    return;
  }
  try {
    const res = await memberApi.getProfile(authStore.memberId);
    profile.value = res.data;
    editName.value = res.data.name;
    timerSettings.timezone = res.data.timezone || 'Asia/Seoul';
    timerSettings.dailyResetHour = res.data.dailyResetHour ?? 5;
  } catch {
    await router.push('/login');
  } finally {
    loading.value = false;
  }
}

async function saveName() {
  nameError.value = '';
  nameSuccess.value = false;
  if (!editName.value.trim()) {
    nameError.value = '이름을 입력해 주세요';
    return;
  }
  saving.value = true;
  try {
    const res = await memberApi.updateProfile(authStore.memberId, { name: editName.value.trim() });
    profile.value = res.data;
    editName.value = res.data.name;
    nameSuccess.value = true;
    setTimeout(() => { nameSuccess.value = false; }, 2000);
  } catch (e) {
    nameError.value = e.response?.data?.error || '저장에 실패했습니다';
  } finally {
    saving.value = false;
  }
}

async function changePassword() {
  pwError.value = '';
  pwSuccess.value = false;
  if (pwForm.next !== pwForm.confirm) {
    pwError.value = '새 비밀번호가 일치하지 않습니다';
    return;
  }
  pwSaving.value = true;
  try {
    await memberApi.updateProfile(authStore.memberId, {
      newPassword: pwForm.next,
      currentPassword: pwForm.current,
    });
    pwForm.current = '';
    pwForm.next = '';
    pwForm.confirm = '';
    pwSuccess.value = true;
    setTimeout(() => { pwSuccess.value = false; }, 2000);
  } catch (e) {
    pwError.value = e.response?.data?.error || '비밀번호 변경에 실패했습니다';
  } finally {
    pwSaving.value = false;
  }
}

async function saveTimerSettings() {
  timerError.value = '';
  timerSuccess.value = false;
  timerSaving.value = true;
  try {
    const res = await memberApi.updateProfile(authStore.memberId, {
      timezone: timerSettings.timezone,
      dailyResetHour: timerSettings.dailyResetHour,
    });
    profile.value = res.data;
    timerSuccess.value = true;
    setTimeout(() => { timerSuccess.value = false; }, 2000);
  } catch (e) {
    timerError.value = e.response?.data?.error || '저장에 실패했습니다';
  } finally {
    timerSaving.value = false;
  }
}

async function handleLogout() {
  await logout();
}

async function handleDeleteAccount() {
  deleteError.value = '';
  deleting.value = true;
  try {
    await memberApi.deleteMember(authStore.memberId);
    authStore.clearAuth();
    await router.push('/');
  } catch (e) {
    deleteError.value = e.response?.data?.error || '탈퇴 처리 중 오류가 발생했습니다';
  } finally {
    deleting.value = false;
  }
}

onMounted(loadProfile);
</script>

<style scoped>
.profile-page { position: relative; }

.profile-body {
  display: flex;
  flex-direction: column;
  max-width: 480px;
  padding-bottom: 80px;
}

/* Hero */
.profile-hero { margin: 48px 0 40px; }

.profile-eyebrow {
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

.profile-eyebrow::before {
  content: '';
  display: inline-block;
  width: 24px;
  height: 1px;
  background: var(--accent);
  opacity: 0.5;
}

.profile-title {
  font-family: var(--font-serif);
  font-size: clamp(36px, 6vw, 52px);
  line-height: 1.08;
  color: var(--text);
  letter-spacing: -0.01em;
}

/* Section */
.profile-section {
  padding: 28px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.profile-section-label {
  display: block;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-2);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin-bottom: 20px;
}

/* Identity */
.identity-row { display: flex; flex-direction: column; gap: 6px; }

.identity-name {
  font-size: 22px;
  font-family: var(--font-serif);
  color: var(--text);
  line-height: 1.3;
}

.identity-email {
  font-size: 13px;
  color: var(--text-2);
  font-family: var(--font-mono);
}

.provider-badge {
  display: inline-block;
  width: fit-content;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: var(--radius);
  border: 1px solid;
  margin-top: 4px;
}

.provider-badge.local {
  color: var(--text-2);
  border-color: var(--border);
}

.provider-badge.google {
  color: var(--accent);
  border-color: rgba(201, 169, 110, 0.3);
}

/* Password fields */
.password-fields {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Section footer */
.section-footer { margin-top: 20px; }

.section-btn {
  width: auto;
  min-width: 100px;
}

/* Messages */
.form-error {
  margin-top: 10px;
  font-size: 12px;
  color: var(--danger);
  font-family: var(--font-mono);
}

.form-success {
  margin-top: 10px;
  font-size: 12px;
  color: var(--running);
  font-family: var(--font-mono);
}

/* Danger zone */
.profile-danger { border-bottom: none; }

.danger-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.delete-warning {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.7;
  margin-bottom: 20px;
}

/* Skeleton */
.profile-skeleton {
  padding-top: 80px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-line {
  background: var(--surface-2);
  border-radius: var(--radius);
  animation: shimmer 1.4s ease infinite;
}

.skeleton-title { height: 48px; width: 200px; }
.skeleton-sub { height: 16px; width: 140px; }

@keyframes shimmer {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
</style>
