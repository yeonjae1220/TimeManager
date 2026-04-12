<template>
  <div class="page">
    <!-- Pull-to-refresh indicator -->
    <div
      class="pull-indicator"
      :style="{
        transform: `translateY(${pullDistance}px)`,
        opacity: Math.min(pullDistance / pullThreshold, 1)
      }"
      v-show="pullDistance > 0 || isPullRefreshing"
    >
      <span class="pull-spinner" :class="{ spinning: isPullRefreshing }"></span>
    </div>

    <div class="topbar">
      <span class="topbar-brand">timemgr</span>
      <div class="topbar-actions">
        <router-link to="/" class="topbar-back">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M10.5 6.5h-8M6 3L2.5 6.5 6 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Home
        </router-link>
        <router-link to="/profile" class="btn btn-ghost profile-btn">Profile</router-link>
        <button
          class="edit-toggle"
          :class="{ 'edit-toggle--active': editMode }"
          @click="editMode = !editMode"
        >
          {{ editMode ? 'Done' : 'Edit' }}
        </button>
      </div>
    </div>

    <header class="list-header">
      <div class="list-header-left">
        <p class="list-eyebrow mono">workspace</p>
        <h1 class="list-title">Tags</h1>
      </div>
      <div class="list-header-right">
        <span class="refreshing-dot" v-if="tagStore.isRefreshing && tagStore.hasCachedData" title="Syncing…"></span>
        <span class="list-count mono" v-if="tagList.length">{{ tagList.length }}</span>
        <button class="add-top-btn" @click="openTopForm" title="New tag">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- Inline top-level add form -->
    <div v-if="showTopForm" class="top-add-form">
      <input
        ref="topInput"
        v-model="topTagName"
        class="top-add-input"
        placeholder="Tag name…"
        @keydown.enter="submitTopTag"
        @keydown.esc="cancelTopForm"
      />
      <button class="add-confirm" @click="submitTopTag" :disabled="isLoading || !rootTagId">Add</button>
      <button class="add-cancel" @click="cancelTopForm">✕</button>
    </div>
    <p v-if="showTopForm && errorMessage" class="top-add-error mono">{{ errorMessage }}</p>

    <div v-if="isLoading" class="empty-state">
      <span class="dot stopped"></span>
      <span class="mono">Loading workspace…</span>
    </div>
    <div v-else-if="fetchError" class="empty-state">
      <span class="dot stopped"></span>
      <span class="mono">태그 목록을 불러오지 못했습니다.</span>
      <button class="create-first-btn mono" @click="fetchTags">새로고침</button>
    </div>
    <div v-else-if="tagList.length === 0" class="empty-state">
      <span class="dot stopped"></span>
      <span class="mono">No tags yet.</span>
      <button class="create-first-btn mono" @click="openTopForm">Create first tag</button>
    </div>

    <ul v-else class="tag-tree">
      <TagItem
        v-for="tag in tagList"
        :key="tag.id"
        :tag="tag"
      />
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, provide, readonly, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import TagItem from '@/components/TagItem.vue';
import { useTagStore } from '@/stores/tagStore';
import { usePullToRefresh } from '@/composables/usePullToRefresh';

const route = useRoute();
const router = useRouter();
const memberId = route.params.id;

const tagStore = useTagStore();
const isLoading = ref(true);

const { isRefreshing: isPullRefreshing, pullDistance, threshold: pullThreshold } = usePullToRefresh(
  () => tagStore.refreshTags(memberId)
);
const editMode = ref(false);
const draggedTagId = ref(null);

const showTopForm = ref(false);
const topTagName  = ref('');
const topInput    = ref(null);
const errorMessage = ref('');

const fetchTags = async () => {
  // 캐시가 없을 때만 로딩 표시
  if (!tagStore.hasCachedData) {
    isLoading.value = true;
  }
  await tagStore.loadTags(memberId);
  isLoading.value = false;
};

const tagList = computed(() => tagStore.tagList);
const fetchError = computed(() => tagStore.fetchError);

// 최상위 태그 생성 시 사용할 ROOT id
const rootTagId = computed(() => tagStore.rootTag?.id);

const openTopForm = async () => {
  showTopForm.value = true;
  await nextTick();
  topInput.value?.focus();
};

const cancelTopForm = () => {
  showTopForm.value = false;
  topTagName.value  = '';
  errorMessage.value = '';
};

const submitTopTag = async () => {
  if (!topTagName.value.trim()) return;
  if (!rootTagId.value) {
    errorMessage.value = '태그 목록을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.';
    return;
  }
  errorMessage.value = '';
  try {
    await apiClient.post(`/api/v1/tags`, {
      tagName:     topTagName.value.trim(),
      memberId:    Number(memberId),
      parentTagId: rootTagId.value,
    });
    cancelTopForm();
    await tagStore.refreshTags(memberId);
  } catch (e) {
    console.error('태그 생성 실패:', e);
    errorMessage.value = '태그 생성에 실패했습니다. 다시 시도해 주세요.';
  }
};

const navigateToDetail = (tagId) => {
  router.push(`/tags/${tagId}`);
};

const handleDrop = async (newParentId, movedId) => {
  if (newParentId === movedId) return;
  try {
    await apiClient.patch(`/api/v1/tags/${movedId}`, { newParentTagId: newParentId });
    await tagStore.refreshTags(memberId);
  } catch (error) {
    console.error('Drop failed:', error);
  }
};

provide('editMode', readonly(editMode));
provide('draggedTagId', readonly(draggedTagId));
provide('onNavigate', navigateToDetail);
provide('onRefresh', () => tagStore.refreshTags(memberId));
provide('onDragStart', (id) => { draggedTagId.value = id; });
provide('onDragEnd', () => { draggedTagId.value = null; });
provide('onDropOn', handleDrop);

onMounted(fetchTags);
</script>

<style scoped>
.topbar-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile-btn {
  height: 28px;
  padding: 0 12px;
  font-size: 11px;
  font-family: var(--font-mono);
  letter-spacing: 0.06em;
}

.edit-toggle {
  background: transparent;
  color: var(--text-3);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: all var(--t);
}
.edit-toggle:hover { color: var(--text-2); border-color: var(--text-3); }
.edit-toggle--active {
  color: var(--accent);
  border-color: rgba(201,169,110,0.35);
  background: var(--accent-dim);
}

.list-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 52px 0 28px;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 0;
}

.list-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 4px;
}

.list-eyebrow {
  font-size: 10px;
  color: var(--text-2);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin-bottom: 10px;
}

.list-title {
  font-family: var(--font-serif);
  font-size: 34px;
  color: var(--text);
  font-weight: 400;
}

.list-count {
  font-size: 12px;
  color: var(--text-3);
}

.add-top-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: transparent;
  color: var(--text-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  transition: color var(--t), border-color var(--t), background var(--t);
}
.add-top-btn:hover {
  color: var(--accent);
  border-color: rgba(201,169,110,0.3);
  background: var(--accent-dim);
}

/* Inline top-level add form */
.top-add-form {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0 10px 40px;
  margin: 0 -40px;
  background: var(--surface);
  border-bottom: 1px solid var(--border-subtle);
}

.top-add-input {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 13px;
  padding: 4px 0;
  outline: none;
  transition: border-color var(--t);
}
.top-add-input:focus { border-bottom-color: var(--accent); }
.top-add-input::placeholder { color: var(--text-3); }

.add-confirm {
  background: transparent;
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  padding: 3px 8px;
  border: 1px solid rgba(201,169,110,0.3);
  border-radius: var(--radius);
  transition: all var(--t);
  flex-shrink: 0;
}
.add-confirm:hover { background: var(--accent-dim); }
.add-confirm:disabled { opacity: 0.4; cursor: not-allowed; }

.add-cancel {
  background: transparent;
  color: var(--text-3);
  font-size: 12px;
  padding: 3px 6px;
  border-radius: var(--radius);
  transition: color var(--t);
  flex-shrink: 0;
  margin-right: 32px;
}
.add-cancel:hover { color: var(--text-2); }

.top-add-error {
  font-size: 11px;
  color: var(--danger, #e05252);
  padding: 4px 0 4px 40px;
  margin: 0;
}

.empty-state {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 56px 0;
  color: var(--text-2);
  font-size: 13px;
}

.create-first-btn {
  background: transparent;
  color: var(--accent);
  font-size: 12px;
  letter-spacing: 0.06em;
  padding: 3px 10px;
  border: 1px solid rgba(201,169,110,0.3);
  border-radius: var(--radius);
  transition: all var(--t);
}
.create-first-btn:hover { background: var(--accent-dim); }

.tag-tree { padding: 4px 0; }

.refreshing-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse-dot 1.2s ease infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.mono { font-family: var(--font-mono); }

/* Pull-to-refresh */
.pull-indicator {
  position: fixed;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  z-index: 50;
}

.pull-spinner {
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
}

.pull-spinner.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
