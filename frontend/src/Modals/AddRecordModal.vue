<script setup>
import {defineEmits, defineProps, ref} from "vue";
import axios from "axios";
import {DateTime} from "luxon";

const props = defineProps({
  isOpen: Boolean,
  tagId: Number,
});
const emit = defineEmits(["close"]);

const formattedStartTime = ref("");
const formattedEndTime = ref("");
const errorMessage = ref("");

const createRecord = async () => {
  if (!formattedStartTime.value || !formattedEndTime.value) {
    errorMessage.value = "시작 시간과 종료 시간을 모두 입력하세요.";
    return;
  }

  try {
    // Vue의 datetime-local 값 → Luxon으로 ISO 8601 형식 변환
    const recordTimeDto = {
      newStartTime: DateTime.fromFormat(formattedStartTime.value, "yyyy-MM-dd'T'HH:mm").toISO(),
      newEndTime: DateTime.fromFormat(formattedEndTime.value, "yyyy-MM-dd'T'HH:mm").toISO(),
    };

    await axios.post(`/api/record/create/${props.tagId}`, recordTimeDto, {
      headers: { "Content-Type": "application/json" },
    });

    alert("레코드가 생성되었습니다.");
    emit("close");
  } catch (error) {
    errorMessage.value = "레코드 생성에 실패했습니다.";
  }
};


/*
DateTime.fromISO().toFormat("yyyy-MM-dd'T'HH:mm")
DateTime.fromISO(newRecord.endTime).toFormat("yyyy-MM-dd'T'HH:mm"
 */

const closeModal = () => {
  emit("close");
};

</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <h3>시간 설정</h3>

      <label>시작 시간:</label>
      <input type="datetime-local" v-model="formattedStartTime" />

      <label>종료 시간:</label>
      <input type="datetime-local" v-model="formattedEndTime" />

      <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>

      <div class="modal-actions">
        <button @click="createRecord">생성</button>
        <button @click="closeModal">닫기</button>
      </div>
    </div>
  </div>
</template>


<style scoped>
/* 모달 스타일 */
.modal-overlay {
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
  border-radius: 8px;
}
.modal-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
}
</style>