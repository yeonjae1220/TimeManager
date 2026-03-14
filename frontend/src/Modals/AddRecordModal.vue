<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
    <div class="modal-panel">

      <div class="modal-header">
        <h2 class="modal-title">Add Session</h2>
        <button class="modal-close" @click="closeModal">×</button>
      </div>

      <div class="fields-stack">
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

      <div class="modal-footer">
        <button class="btn btn-ghost" @click="closeModal">Cancel</button>
        <button class="btn btn-primary" @click="createRecord">Create session</button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { defineEmits, defineProps, ref } from 'vue';
import apiClient from '@/utils/apiClient';
import { DateTime } from 'luxon';

const props = defineProps({
  isOpen: Boolean,
  tagId:  Number,
});

const emit = defineEmits(['close']);

const formattedStartTime = ref('');
const formattedEndTime   = ref('');
const errorMessage       = ref('');

const createRecord = async () => {
  if (!formattedStartTime.value || !formattedEndTime.value) {
    errorMessage.value = '시작 시간과 종료 시간을 모두 입력하세요.';
    return;
  }
  try {
    const recordTimeDto = {
      tagId:        props.tagId,
      newStartTime: DateTime.fromFormat(formattedStartTime.value, "yyyy-MM-dd'T'HH:mm").toISO(),
      newEndTime:   DateTime.fromFormat(formattedEndTime.value,   "yyyy-MM-dd'T'HH:mm").toISO(),
    };
    await apiClient.post(`/api/v1/records`, recordTimeDto, {
      headers: { 'Content-Type': 'application/json' },
    });
    emit('close');
  } catch {
    errorMessage.value = '레코드 생성에 실패했습니다.';
  }
};

const closeModal = () => emit('close');
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

.modal-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding-top: 28px;
}
</style>
