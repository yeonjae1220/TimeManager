<template>
  <Teleport to="body">
  <div v-if="isOpen" class="modal-overlay">
    <div ref="panelRef" class="modal-panel">

      <!-- ── 헤더 ── -->
      <div class="modal-header">
        <h2 class="modal-title">
          <template v-if="!overlapData">Edit Session</template>
          <template v-else-if="overlapStep === 1">Time Conflict</template>
          <template v-else>Confirm Delete</template>
        </h2>
        <button class="modal-close" @click="closeModal">×</button>
      </div>

      <!-- ── 일반 폼 ── -->
      <div v-if="!overlapData" class="fields-stack">
        <div class="field">
          <label>Start time</label>
          <input type="datetime-local" v-model="formattedStartTime" />
        </div>
        <div class="field">
          <label>End time</label>
          <input type="datetime-local" v-model="formattedEndTime" />
        </div>
        <p v-if="errorMessage" class="error-msg">{{ errorMessage }}</p>
      </div>

      <!-- ── Step 1: 겹치는 태그 안내 ── -->
      <div v-else-if="overlapStep === 1" class="overlap-body">
        <p class="overlap-desc">다음 태그와 시간대가 겹칩니다.</p>
        <ul class="overlap-tag-list">
          <li v-for="tag in overlapData.overlappingTags" :key="tag.tagId" class="overlap-tag-item">
            <span class="dot" />
            <span>{{ tag.tagName }}</span>
          </li>
        </ul>
        <p class="overlap-question">해당 시간대를 덮어쓰겠습니까?</p>
      </div>

      <!-- ── Step 2: 삭제될 레코드 + 경고 ── -->
      <div v-else class="overlap-body">
        <p class="overlap-desc">다음 기록이 <strong>영구 삭제</strong>됩니다.</p>
        <ul class="record-delete-list">
          <li v-for="rec in overlapData.recordsToDelete" :key="rec.recordId" class="record-delete-item">
            <span class="rec-tag">{{ rec.tagName }}</span>
            <span class="rec-time">{{ fmtTime(rec.startTime) }} – {{ fmtTime(rec.endTime) }}</span>
          </li>
        </ul>
        <div class="irreversible-warn">
          <span class="warn-icon">⚠</span>
          이 작업은 되돌릴 수 없습니다.
        </div>
      </div>

      <!-- ── 푸터 ── -->
      <div class="modal-footer">
        <!-- 일반 폼 -->
        <template v-if="!overlapData">
          <button class="btn btn-danger" @click="deleteRecord">Delete</button>
          <div class="footer-right">
            <button class="btn btn-ghost" @click="closeModal">Cancel</button>
            <button class="btn btn-primary" @click="updateRecord">Save</button>
          </div>
        </template>

        <!-- Step 1 -->
        <template v-else-if="overlapStep === 1">
          <button class="btn btn-ghost" @click="cancelOverlap">취소</button>
          <button class="btn btn-primary" @click="overlapStep = 2">계속 →</button>
        </template>

        <!-- Step 2 -->
        <template v-else>
          <button class="btn btn-ghost" @click="cancelOverlap">취소</button>
          <button class="btn btn-danger confirm-btn" @click="forceUpdate">⚠ 최종 확인</button>
        </template>
      </div>

    </div>
  </div>
  </Teleport>
</template>

<script setup>
import { defineProps, defineEmits, ref, watch, onBeforeUnmount } from 'vue';
import apiClient from '@/utils/apiClient';
import { DateTime } from 'luxon';

const props = defineProps({
  isOpen:     Boolean,
  recordData: Object,
});

const emit = defineEmits(['close']);

const formattedStartTime = ref('');
const formattedEndTime   = ref('');
const errorMessage       = ref('');
const overlapData        = ref(null);
const overlapStep        = ref(1);
const panelRef           = ref(null);

const onKeydown = (e) => { if (e.key === 'Escape') closeModal(); };
const onDocumentClick = (e) => {
  if (panelRef.value && !panelRef.value.contains(e.target)) closeModal();
};

watch(() => props.isOpen, (open) => {
  if (open) {
    setTimeout(() => {
      document.addEventListener('keydown', onKeydown);
      document.addEventListener('click', onDocumentClick);
    }, 0);
  } else {
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('click', onDocumentClick);
  }
}, { immediate: true });

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  document.removeEventListener('click', onDocumentClick);
});

watch(
  () => props.recordData,
  (rec) => {
    if (rec) {
      formattedStartTime.value = rec.startTime
        ? DateTime.fromISO(rec.startTime).toFormat("yyyy-MM-dd'T'HH:mm")
        : '';
      formattedEndTime.value = rec.endTime
        ? DateTime.fromISO(rec.endTime).toFormat("yyyy-MM-dd'T'HH:mm")
        : '';
    }
  },
  { immediate: true }
);

// ── 시간 포맷 헬퍼 ──────────────────────────────────────────
const fmtTime = (iso) =>
  DateTime.fromISO(iso).toFormat('MM/dd HH:mm');

// ── 페이로드 빌더 ──────────────────────────────────────────
const buildPayload = (force) => ({
  newStartTime: DateTime.fromFormat(formattedStartTime.value, "yyyy-MM-dd'T'HH:mm").toISO(),
  newEndTime:   DateTime.fromFormat(formattedEndTime.value,   "yyyy-MM-dd'T'HH:mm").toISO(),
  forceOverwrite: force,
});

// ── 수정 저장 ────────────────────────────────────────────
const updateRecord = async () => {
  errorMessage.value = '';
  try {
    await apiClient.put(`/api/v1/records/${Number(props.recordData.id)}`, buildPayload(false));
    closeModal();
  } catch (err) {
    if (err.response?.status === 409 && err.response?.data?.code === 'RECORD_OVERLAP') {
      overlapData.value = err.response.data;
      overlapStep.value = 1;
    } else {
      errorMessage.value = err.response?.data?.error ?? '레코드 수정에 실패했습니다.';
    }
  }
};

// ── 강제 저장 (Step 2 확인 후) ───────────────────────────────
const forceUpdate = async () => {
  try {
    await apiClient.put(`/api/v1/records/${Number(props.recordData.id)}`, buildPayload(true));
    closeModal();
  } catch (err) {
    cancelOverlap();
    errorMessage.value = err.response?.data?.error ?? '레코드 수정에 실패했습니다.';
  }
};

// ── 삭제 ────────────────────────────────────────────────
const deleteRecord = async () => {
  if (!confirm('이 세션을 삭제하시겠습니까?')) return;
  try {
    await apiClient.delete(`/api/v1/records/${props.recordData.id}`);
    closeModal();
  } catch (err) {
    console.error('레코드 삭제 실패', err);
  }
};

const cancelOverlap = () => {
  overlapData.value = null;
  overlapStep.value = 1;
};

const closeModal = () => {
  overlapData.value = null;
  overlapStep.value = 1;
  errorMessage.value = '';
  emit('close');
};
</script>

<style scoped>
.fields-stack {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.error-msg {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--danger);
  letter-spacing: 0.04em;
}

/* ── 겹침 UI ── */
.overlap-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.overlap-desc {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.5;
}

.overlap-question {
  font-size: 13px;
  color: var(--text);
}

.overlap-tag-list,
.record-delete-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.overlap-tag-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.record-delete-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: var(--danger-dim);
  border-radius: 6px;
  font-size: 12px;
}

.rec-tag {
  color: var(--danger);
  font-weight: 500;
}

.rec-time {
  font-family: var(--font-mono);
  color: var(--text-2);
  font-size: 11px;
}

.irreversible-warn {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--danger);
  font-weight: 500;
  padding: 10px 12px;
  border: 1px solid rgba(176, 86, 86, 0.3);
  border-radius: 6px;
  background: var(--danger-dim);
}

.warn-icon {
  font-size: 14px;
}

.confirm-btn {
  border: 1px solid rgba(176, 86, 86, 0.5);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 28px;
}

.footer-right {
  display: flex;
  gap: 8px;
}
</style>
