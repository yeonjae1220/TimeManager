<template>
  <div v-if="isOpen" class="modal" @click.self="closeModal">
    <div class="modal-content">
      <h3>시간 수정</h3>

      <label>시작 시간:</label>
      <input type="datetime-local" v-model="formattedStartTime" />

      <label>종료 시간:</label>
      <input type="datetime-local" v-model="formattedEndTime" />

      <div class="modal-actions">
        <button @click="updateRecord">수정 완료</button>
        <button @click="deleteRecord" class="delete-button">삭제</button>
        <button @click="closeModal">닫기</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, ref, watch, defineEmits } from "vue";
import axios from "axios";
import { DateTime } from "luxon"; // Luxon 사용

const props = defineProps({
  isOpen: Boolean,
  recordData: Object,
});

const emit = defineEmits(["close"]);

// ✅ ZonedDateTime → local datetime 변환 (ISO 8601 → YYYY-MM-DDTHH:mm 형식)
const formattedStartTime = ref("");
const formattedEndTime = ref("");

watch(
    () => props.recordData,
    (newRecord) => {
      if (newRecord) {
        formattedStartTime.value = newRecord.startTime
            ? DateTime.fromISO(newRecord.startTime).toFormat("yyyy-MM-dd'T'HH:mm")
            : "";
        formattedEndTime.value = newRecord.endTime
            ? DateTime.fromISO(newRecord.endTime).toFormat("yyyy-MM-dd'T'HH:mm")
            : "";
      }
    },
    { immediate: true }
);

const updateRecord = async () => {
  try {
    await axios.put(`/api/record/updateTime/${Number(props.recordData.id)}`, {
      newStartTime: DateTime.fromFormat(formattedStartTime.value, "yyyy-MM-dd'T'HH:mm").toISO(),
      newEndTime: DateTime.fromFormat(formattedEndTime.value, "yyyy-MM-dd'T'HH:mm").toISO(),
    });
    alert("시간이 변경되었습니다.");
  } catch (error) {
    console.error("레코드 시간 변경 실패", error);
  }
};

const deleteRecord = async () => {
  if (!confirm("정말 삭제하시겠습니까?")) return;
  try {
    await axios.delete(`/api/record/delete/${props.recordData.id}`);
    alert("레코드가 삭제되었습니다.");
  } catch (error) {
    console.error("레코드 삭제 실패", error);
  }
};

const closeModal = () => {
  emit("close");
};
</script>

<style scoped>
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 10px;
  min-width: 300px;
}

.modal-actions {
  margin-top: 10px;
  display: flex;
  justify-content: space-between;
}

.delete-button {
  background-color: red;
  color: white;
}
</style>