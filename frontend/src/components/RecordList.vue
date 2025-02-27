<template>
  <div>
    <h3>TagId {{ tagId }} Log</h3>
    <button @click="openAddRecordModal()" class="modalBtn"></button>
    <div v-if="loading">⏳ Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <ul v-else>
      <li v-for="record in records" :key="record.id">
        ⏱ {{ formatZonedDateTime(record.startTime) }} ~ {{ formatZonedDateTime(record.endTime) }}
        {{ formatTotalTime(record.totalTime) }}
        <button @click="openEditModal(record)" class="modalBtn">
          <Menu name="menu" />
        </button>
      </li>
    </ul>
    <AddRecordModal
        v-if="isAddRecordModalOpen"
        :isOpen="isAddRecordModalOpen"
        :tagId="Number(tagId)"
        @close="isAddRecordModalOpen = false"
    />

    <!-- EditRecordModal -->
    <EditRecordModal
        v-if="isEditRecordModalOpen"
        :isOpen="isEditRecordModalOpen"
        :recordData="selectedRecord"
        @close="isEditRecordModalOpen = false"
    />
  </div>


</template>

<script setup>
import { onMounted, ref } from "vue";
import axios from "axios";
import { useRoute } from "vue-router";
import EditRecordModal from "@/Modals/EditRecordModal.vue";
import { Menu } from "lucide-vue-next";
import { DateTime } from "luxon";
import AddRecordModal from "@/Modals/AddRecordModal.vue"; // Luxon 사용

const route = useRoute();
const tagId = route.params.id;

const records = ref([]);
const loading = ref(false);
const error = ref(null);
const isEditRecordModalOpen = ref(false);
const isAddRecordModalOpen = ref(false);
const selectedRecord = ref(null); // 선택된 record 저장

// ✅ 데이터를 불러오는 함수
const fetchRecords = async () => {
  loading.value = true;
  error.value = null;
  try {
    console.log("axios tagId = " + tagId);
    const response = await axios.get(`/api/record/log/${tagId}`);
    records.value = response.data;
  } catch (err) {
    error.value = "데이터를 불러오지 못했습니다.";
  } finally {
    loading.value = false;
  }
};

// ✅ `ZonedDateTime`을 로컬 시간대로 변환하여 표시
const formatZonedDateTime = (isoString) => {
  if (!isoString) return "시간 없음";
  return DateTime.fromISO(isoString).toFormat("yyyy-MM-dd HH:mm:ss");
};

// ✅ 초 단위를 "HH:mm:ss" 형식으로 변환하는 함수
const formatTotalTime = (totalSeconds) => {
  if (!totalSeconds) return "00:00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

// ✅ EditRecordModal 열기
const openEditModal = (record) => {
  selectedRecord.value = record;
  isEditRecordModalOpen.value = true;
};

const openAddRecordModal = () => {
  isAddRecordModalOpen.value = true;
}

// ✅ 컴포넌트 마운트 시 데이터 가져오기
onMounted(fetchRecords);
</script>

<style scoped>
.error {
  color: red;
}
</style>