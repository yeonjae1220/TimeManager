<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
    <div class="modal-panel">

      <div class="modal-header">
        <h2 class="modal-title">Edit Session</h2>
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
      </div>

      <div class="modal-footer">
        <button class="btn btn-danger" @click="deleteRecord">Delete</button>
        <div class="footer-right">
          <button class="btn btn-ghost" @click="closeModal">Cancel</button>
          <button class="btn btn-primary" @click="updateRecord">Save</button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { defineProps, ref, watch, defineEmits } from 'vue';
import axios from 'axios';
import { DateTime } from 'luxon';

const props = defineProps({
  isOpen:     Boolean,
  recordData: Object,
});

const emit = defineEmits(['close']);

const formattedStartTime = ref('');
const formattedEndTime   = ref('');

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

const updateRecord = async () => {
  try {
    await axios.put(`/api/record/updateTime/${Number(props.recordData.id)}`, {
      newStartTime: DateTime.fromFormat(formattedStartTime.value, "yyyy-MM-dd'T'HH:mm").toISO(),
      newEndTime:   DateTime.fromFormat(formattedEndTime.value,   "yyyy-MM-dd'T'HH:mm").toISO(),
    });
    closeModal();
  } catch (error) {
    console.error('레코드 시간 변경 실패', error);
  }
};

const deleteRecord = async () => {
  if (!confirm('이 세션을 삭제하시겠습니까?')) return;
  try {
    await axios.delete(`/api/record/delete/${props.recordData.id}`);
    closeModal();
  } catch (error) {
    console.error('레코드 삭제 실패', error);
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
