<template>
  <div class="stopwatch-container">
    <h2>{{ tagData.name }} Timer</h2>

    <div class="time-display">
      <p>Stopwatch: {{ formattedElapsedTime }}</p>
      <p>Daily Accumulated Time: {{ formattedAccumulatedTime }}</p>
      <p v-if="dailyGoalTime > 0">Remaining Time: {{ formattedRemainingTime }}</p>
      <p>Latest Start Time: {{ formattedStartTime || 'Not started' }}</p>
      <p>End Time: {{ formattedEndTime || 'Not stopped' }}</p>
      <p>tagTotalTIme : {{ formattedTagTotalTime }}</p>
      <p>총 시간: {{ formattedTotalTime }} Sec</p>
    </div>

    <div class="buttons">
      <button @click="startStopwatch" :disabled="stopwatch.isRunning">Start</button>
      <button @click="stopStopwatch" :disabled="!stopwatch.isRunning">Stop</button>
      <button @click="resetStopwatch" :disabled="stopwatch.isRunning">Reset</button>
    </div>
  </div>
</template>

<script setup>
import {reactive, computed, watch, watchEffect, ref, onMounted} from "vue";
import axios from "axios";

const props = defineProps({
  tagData: Object, // 부모에서 받은 태그 데이터
});

// ✅ 태그별 스톱워치 상태 저장
const stopwatchState = reactive({});

// ✅ 특정 태그의 상태 가져오기 (없으면 초기화)
const getStopwatchState = (id) => {
  stopwatchState[id] = {
    isRunning: props.tagData.state,
    latestStartTime: props.tagData.latestStartTime || null,
    latestEndTime: props.tagData.latestStopTime || null,
    elapsedTime: props.tagData.elapsedTime || 0,
    dailyTotalTime: props.tagData.dailyTotalTime || 0,
    tagTotalTime: props.tagData.tagTotalTime || 0,
    totalTime: props.tagData.totalTime || 0,
    // latestStartTime: null,
    rAF_ID: null,

    timeElapsed: 0, // timer에 나타나는 시간
    accumulatedTime: 0, // dailyTotalTime 나타내는 시간
    tagTotalTimeCal: 0,
    totalTimeCal: 0,
  };
  return stopwatchState[id];
};

// ✅ 현재 태그 ID
const stopwatch = getStopwatchState(props.tagData?.id);

// ✅ `watch`로 태그 변경 감지 → 새 상태 로드, start 누르고 그대로 다른데서 접속 한 경우도 확인 가능 (아마도)
watch(() => props.tagData, (newData) => {
  if (newData) {
    stopwatch.isRunning = newData.state;
    stopwatch.latestStartTime = newData.latestStartTime;
    stopwatch.latestEndTime = newData.latestEndTime;
    stopwatch.elapsedTime = newData.elapsedTime;
    stopwatch.dailyTotalTime = newData.dailyTotalTime || 0;
    stopwatch.tagTotalTime = newData.tagTotalTime || 0;
    stopwatch.totalTime = newData.totalTime || 0;

    const newTagId = newData.id;
    if (!stopwatchState[newTagId]) {
      stopwatchState[newTagId] = getStopwatchState(newTagId);
    }
  }
},
    {deep : true, immediate: true} // 객체 내부 값이 변해도 감지
);

onMounted(() => {
  // 처음 페이지 접속 시, 서버에서 가져오는 초기값들을 template에서 보여주기 위한 초기값 할당, 좌변 애들은 전부 계산에 쓰이기 위해 별도로 만든 변수
  stopwatch.timeElapsed = stopwatch.elapsedTime;
  stopwatch.accumulatedTime = stopwatch.dailyTotalTime;
  stopwatch.tagTotalTimeCal = stopwatch.tagTotalTime;
  stopwatch.totalTimeCal = stopwatch.totalTime;
})


// 1970년 1월 1일이면 "No Data", 아니면 변환된 날짜 표시
const formattedStartTime = ref("No Data");
const formattedEndTime = ref("No Data");

watchEffect(() => {
  console.log("Stopwatch latestStartTime Updated:", stopwatch.latestStartTime);
  if (!stopwatch || !stopwatch.latestStartTime) return;
  const date = new Date(stopwatch.latestStartTime);
  formattedStartTime.value = date.getFullYear() === 1970 ? "No Data" : date.toLocaleTimeString();
});

watchEffect(() => {
  console.log("Stopwatch latestStopTime Updated:", stopwatch.latestStartTime);
  if (!stopwatch || !stopwatch.latestEndTime) return;
  const date = new Date(stopwatch.latestEndTime);
  formattedEndTime.value = date.getFullYear() === 1970 ? "No Data" : date.toLocaleTimeString();
});

// ✅ 타이머 포맷 함수 (HH:mm:ss)
const formatTime = (seconds) => {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

// ✅ 계산된 값들
const formattedElapsedTime = computed(() => formatTime(stopwatch.timeElapsed));
const formattedAccumulatedTime = computed(() => formatTime(stopwatch.accumulatedTime));
const dailyGoalTime = computed(() => props.tagData?.dailyGoalTime || 0);
const formattedRemainingTime = computed(() => {
  const remainingTime = dailyGoalTime.value - stopwatch.accumulatedTime;
  return `+${formatTime(Math.max(0, remainingTime))}`;
});
// 할 것 얘내 연산 해주기
const formattedTagTotalTime = computed(() => formatTime(stopwatch.tagTotalTimeCal));
const formattedTotalTime = computed(() => formatTime(stopwatch.totalTimeCal));

// ✅ 스톱워치 업데이트 (애니메이션 프레임)
const updateTimer = () => {
  if (!stopwatch.latestStartTime) return;

  const currentTime = Date.now();
  const deltaTime = Math.floor((currentTime - stopwatch.latestStartTime) / 1000);
  stopwatch.timeElapsed = deltaTime + stopwatch.elapsedTime;
  stopwatch.accumulatedTime = stopwatch.dailyTotalTime + stopwatch.timeElapsed - stopwatch.elapsedTime; // 정상 작동 하나 확인 필요

  stopwatch.tagTotalTimeCal = stopwatch.tagTotalTime + deltaTime; // 얘 고쳐야 함 축척시간이 더해져서 뻥튀기됨
  console.log("태그토탈타임 체크 tagTotalTime : " + stopwatch.tagTotalTime + " accumulatedTime : " + stopwatch.accumulatedTime)
  stopwatch.totalTimeCal = stopwatch.totalTime + deltaTime;

  stopwatch.rAF_ID = requestAnimationFrame(updateTimer);
};

// ✅ 스톱워치 시작
const startStopwatch = async () => {
  if (stopwatch.isRunning) return;
  console.log("before start dailyTotalTime : " + stopwatch.dailyTotalTime)
  stopwatch.isRunning = true;
  stopwatch.latestStartTime = Date.now();
  console.log("Updated latestStartTime:", stopwatch.latestStartTime);
  updateTimer();
  // stopwatch.latestStartTime = new Date(stopwatch.latestStartTime).toLocaleTimeString();
  // stopwatch.latestStartTime = new Date(stopwatch.latestStartTime).toISOString();
  console.log("after start dailyTotalTime : " + stopwatch.dailyTotalTime)

  try {
    await axios.post(`/api/tag/${props.tagData.id}/start`, new Date(stopwatch.latestStartTime).toISOString(), {
      headers: {"Content-Type": "application/json"},
    });
  } catch (error) {
    console.error("스톱워치 시작 실패:", error);
  }
};

// ✅ 스톱워치 종료
const stopStopwatch = async () => {
  if (!stopwatch.isRunning) return;
  console.log("before end dailyTotalTime : " + stopwatch.dailyTotalTime)
  stopwatch.isRunning = false;
  cancelAnimationFrame(stopwatch.rAF_ID);
  // stopwatch.endTime = new Date().toLocaleTimeString();
  console.log("after end dailyTotalTime : " + stopwatch.dailyTotalTime)
  stopwatch.latestEndTime = Date.now();
  const delta = Math.floor(stopwatch.latestEndTime - stopwatch.latestStartTime) / 1000
  stopwatch.elapsedTime += delta;
  stopwatch.dailyTotalTime += delta;
  stopwatch.tagTotalTime += delta;
  stopwatch.totalTime += delta;
  console.log("before end cal dailyTotalTime : " + stopwatch.dailyTotalTime)

  try {
    await axios.post(
        `/api/record/${props.tagData.id}/stop`,
        {elapsedTime: stopwatch.elapsedTime,
          timestamps: {
            startTime: new Date(stopwatch.latestStartTime).toISOString(),
            endTime: new Date().toISOString()
          }},
        {headers: {"Content-Type": "application/json"}}
    );
  } catch (error) {
    console.error("스톱워치 종료 실패:", error);
  }
};

// ✅ 스톱워치 리셋
const resetStopwatch = async () => {
  if (stopwatch.isRunning) return;
  stopwatch.timeElapsed = 0;
  stopwatch.elapsedTime = 0;

  try {
    await axios.post(
        `/api/tag/${props.tagData.id}/reset`,
        {elapsedTime: stopwatch.elapsedTime,
          },
        {headers: {"Content-Type": "application/json"}}
    );
  } catch (error) {
    console.error("스톱워치 종료 실패:", error);
  }

};

</script>

<style scoped>
.stopwatch-container {
  text-align: center;
}

.time-display p {
  font-size: 1.2rem;
  margin: 5px 0;
}

.buttons button {
  margin: 10px;
  padding: 10px 20px;
  font-size: 1rem;
  cursor: pointer;
}
</style>