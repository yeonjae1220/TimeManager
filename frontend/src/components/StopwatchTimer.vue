<template>
  <div>
    <h1>스톱워치</h1>
    <p>경과 시간: {{ formattedElapsedTime }}</p>
    <p>시작 시간: {{ formattedStartTime }}</p>
    <button @click="startStopwatch">Start</button>
    <button @click="stopStopwatch" :disabled="!startTime">Stop</button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch} from "vue";
import {useRoute} from "vue-router";
import axios from "axios";

// ✅ 현재 URL에서 tagId 가져오기
const route = useRoute();
const tagId = ref(route.params.id); // URL에서 tagId 설정

const startTime = ref(null);
const elapsedTime = ref(0);
const isRunning = ref(false);
let rAF_ID = null; // requestAnimationFrame ID

// ✅ HH:mm:ss 형식 변환
const formatTime = (seconds) => {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

// ✅ 스톱워치 애니메이션 프레임
const updateTimer = () => {
  if (!startTime.value) return;

  const currentTime = Date.now();
  elapsedTime.value = (currentTime - startTime.value) / 1000; // 초 단위 변환

  rAF_ID = requestAnimationFrame(updateTimer);
};


// ✅ 서버에서 시작 시간 불러오기
const fetchStartTime = async () => {
  try {
    const response = await axios.get(`/api/tag/${tagId.value}/getStartTime`);
    startTime.value = response.data;
    console.log("서버에서 불러온 시작 시간:", startTime.value);

    // 🟢 1970년 1월 1일이면 '-'로 표시
    if (startTime.value.startsWith("1970")) {
      startTime.value = "-";
    }

    console.log("서버에서 불러온 시작 시간:", startTime.value);

    if (startTime.value !== "-") {
      startTime.value = new Date(response.data).getTime();
      isRunning.value = true;
      updateTimer();
    }
  } catch (error) {
    console.error("시작 시간 불러오기 실패:", error);
    startTime.value = "-"; // 404 또는 204일 경우 '-' 표시
  }
};

// ✅ 스톱워치 시작
const startStopwatch = async () => {
  startTime.value = Date.now();
  isRunning.value = true;
  updateTimer();

  try {
    await axios.post(`/api/tag/${tagId.value}/start`, startTime.value, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("스톱워치 시작 실패:", error);
  }
};

// ✅ 스톱워치 종료
const stopStopwatch = async () => {
  isRunning.value = false;
  cancelAnimationFrame(rAF_ID);

  try {
    const endTime = new Date().toISOString();
    await axios.post(
        `/api/record/${tagId.value}/stop`,
        { startTime: new Date(startTime.value).toISOString(), endTime },
        { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("스톱워치 종료 실패:", error);
  }

  startTime.value = null;
  elapsedTime.value = 0;
};

// ✅ `watch`로 URL 변경 감지 → tagId가 변경되면 새 데이터 요청
watch(() => route.params.id, (newId) => {
  tagId.value = newId;
  fetchStartTime();
});

// ✅ 컴포넌트 마운트 시 서버 데이터 불러오기
onMounted(() => {
  fetchStartTime();
});

// ✅ 컴포넌트 언마운트 시 애니메이션 중지
onUnmounted(() => {
  cancelAnimationFrame(rAF_ID);
});

// ✅ 화면에 표시할 값
const formattedStartTime = computed(() => (startTime.value ? new Date(startTime.value).toLocaleString() : "-"));
const formattedElapsedTime = computed(() => formatTime(elapsedTime.value));

</script>