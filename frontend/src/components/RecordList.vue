<template>
  <div class="page">
    <div class="topbar">
      <router-link to="/" class="topbar-brand">timemgr</router-link>
      <router-link :to="`/tags/${tagId}`" class="topbar-back">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M10.5 6.5h-8M6 3L2.5 6.5 6 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Tag
      </router-link>
    </div>

    <header class="records-header">
      <div>
        <p class="records-eyebrow mono">tag · {{ tagId }}</p>
        <h1 class="records-title">Sessions</h1>
      </div>
      <button class="btn btn-ghost add-btn" @click="openAddRecordModal">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        Add record
      </button>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="state-row">
      <span class="dot stopped"></span>
      <span class="mono">Loading…</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="state-row error-state">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.1"/>
        <path d="M7 4v4M7 9.5v.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Empty -->
    <div v-else-if="records.length === 0" class="state-row">
      <span class="dot stopped"></span>
      <span class="mono">No sessions recorded yet.</span>
    </div>

    <!-- Records Table -->
    <div v-else class="records-list">
      <div class="records-list-header">
        <span class="col-label mono">Start</span>
        <span class="col-label mono">End</span>
        <span class="col-label mono">Duration</span>
        <span></span>
      </div>

      <div
        v-for="record in records"
        :key="record.id"
        class="record-row"
      >
        <span class="record-time mono">{{ formatZonedDateTime(record.startTime) }}</span>
        <span class="record-time mono">{{ formatZonedDateTime(record.endTime) }}</span>
        <span class="record-duration mono">{{ formatTotalTime(record.totalTime) }}</span>
        <button class="record-edit-btn" @click="openEditModal(record)" title="Edit">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M9 2.5l1.5 1.5L4 10.5H2.5V9L9 2.5z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Modals -->
    <AddRecordModal
      v-if="isAddRecordModalOpen"
      :isOpen="isAddRecordModalOpen"
      :tagId="Number(tagId)"
      @close="handleAddModalClose"
    />
    <EditRecordModal
      v-if="isEditRecordModalOpen"
      :isOpen="isEditRecordModalOpen"
      :recordData="selectedRecord"
      @close="handleEditModalClose"
    />
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import apiClient from '@/utils/apiClient';
import { useRoute } from 'vue-router';
import EditRecordModal from '@/Modals/EditRecordModal.vue';
import AddRecordModal  from '@/Modals/AddRecordModal.vue';
import { DateTime } from 'luxon';

const route = useRoute();
const tagId = route.params.id;

const records              = ref([]);
const loading              = ref(false);
const error                = ref(null);
const isEditRecordModalOpen = ref(false);
const isAddRecordModalOpen  = ref(false);
const selectedRecord        = ref(null);

const fetchRecords = async () => {
  loading.value = true;
  error.value   = null;
  try {
    const response = await apiClient.get(`/api/v1/records?tagId=${tagId}`);
    records.value = response.data;
  } catch {
    error.value = '데이터를 불러오지 못했습니다.';
  } finally {
    loading.value = false;
  }
};

const formatZonedDateTime = (isoString) => {
  if (!isoString) return '—';
  return DateTime.fromISO(isoString).toFormat('MM-dd  HH:mm');
};

const formatTotalTime = (totalSeconds) => {
  if (!totalSeconds) return '00:00:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};

const openEditModal = (record) => {
  selectedRecord.value       = record;
  isEditRecordModalOpen.value = true;
};

const openAddRecordModal = () => { isAddRecordModalOpen.value = true; };

const handleAddModalClose = () => {
  isAddRecordModalOpen.value = false;
  fetchRecords();
};

const handleEditModalClose = () => {
  isEditRecordModalOpen.value = false;
  fetchRecords();
};

// 온라인 복귀 시 BackgroundSync가 timer/stop을 재전송하고
// 서버가 record를 생성한 이후를 반영하기 위해 즉시 + 지연 갱신
const handleOnline = () => {
  fetchRecords();
  setTimeout(() => fetchRecords(), 3000);
};

onMounted(() => {
  fetchRecords();
  window.addEventListener('online', handleOnline);
});

onBeforeUnmount(() => {
  window.removeEventListener('online', handleOnline);
});
</script>

<style scoped>
.records-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 52px 0 28px;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 0;
}

.records-eyebrow {
  font-size: 10px;
  color: var(--text-2);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin-bottom: 10px;
}

.records-title {
  font-family: var(--font-serif);
  font-size: 34px;
  color: var(--text);
  font-weight: 400;
}

.add-btn {
  margin-bottom: 4px;
  font-size: 11px;
}

/* States */
.state-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 56px 0;
  color: var(--text-2);
  font-size: 13px;
}
.error-state { color: var(--danger); }

/* Table */
.records-list { padding-top: 0; }

.records-list-header {
  display: grid;
  grid-template-columns: 1fr 1fr 120px 36px;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.col-label {
  font-size: 10px;
  color: var(--text-3);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.record-row {
  display: grid;
  grid-template-columns: 1fr 1fr 120px 36px;
  gap: 16px;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--border-subtle);
  transition: background var(--t);
  margin: 0 -40px;
  padding-left: 40px;
  padding-right: 40px;
}

.record-row:hover { background: var(--surface); }
.record-row:last-child { border-bottom: none; }

.record-time {
  font-size: 12px;
  color: var(--text-2);
}

.record-duration {
  font-size: 13px;
  color: var(--text);
}

.record-edit-btn {
  background: transparent;
  color: var(--text-3);
  padding: 6px;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  transition: color var(--t);
  opacity: 0;
}

.record-row:hover .record-edit-btn { opacity: 1; }
.record-edit-btn:hover { color: var(--text); }

.mono { font-family: var(--font-mono); }

@media (max-width: 768px) {
  .records-header {
    align-items: flex-start;
    padding: 36px 0 24px;
  }

  .records-title {
    font-size: 28px;
  }

  .add-btn {
    width: 100%;
    justify-content: center;
    margin-bottom: 0;
  }

  .records-list-header {
    display: none;
  }

  .record-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 16px;
    margin: 0;
    padding: 18px 0;
    align-items: start;
  }

  .record-time,
  .record-duration {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .record-time::before,
  .record-duration::before {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-3);
  }

  .record-row > .record-time:first-of-type::before {
    content: 'Start';
  }

  .record-row > .record-time:nth-of-type(2)::before {
    content: 'End';
  }

  .record-duration::before {
    content: 'Duration';
  }

  .record-row > .record-duration {
    grid-column: 1 / 2;
  }

  .record-edit-btn {
    grid-column: 2 / 3;
    justify-self: end;
    align-self: end;
    opacity: 1;
    padding: 8px;
    border: 1px solid var(--border-subtle);
  }
}

@media (max-width: 480px) {
  .records-title {
    font-size: 24px;
  }

  .record-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }

  .record-row > .record-duration,
  .record-edit-btn {
    grid-column: auto;
  }

  .record-edit-btn {
    justify-self: start;
  }
}
</style>
