<template>
  <div> <!-- 단일 루트 요소 유지 -->
    <div class="relative">
      <button @click="isModalOpen = true" class="modalBtn">
        <Menu name="menu"/>
      </button>
      <!-- 태그 관리 모달 -->
      <TagModal v-if="isModalOpen" :isOpen="isModalOpen" :tagData="tag" @close="isModalOpen = false" />
    </div>

    <div>
      <!-- 🟢 태그의 스톱워치 컴포넌트 추가 -->
      <div class="stopwatch-container" v-if="tag">
        <h2>{{ tag.name }} Timer</h2>

        <div class="time-display">
          <p>Stopwatch: {{ formattedElapsedTime }}</p>
          <p>Daily Accumulated Time: {{ formattedDailyTotalTime }}</p>
          <p v-if="dailyGoalTime > 0">Remaining Time: {{ formattedRemainingTime }}</p>
          <p>Latest Start Time: {{ formattedStartTime || 'Not started' }}</p>
          <p>End Time: {{ formattedEndTime || 'Not stopped' }}</p>
          <p>tagTotalTime : {{ formattedTagTotalTime }}</p>
          <p>총 시간: {{ formattedTotalTime }} Sec</p>
        </div>

        <div class="buttons">
          <button @click="startStopwatch" :disabled="stopwatchState.isRunning">Start</button>
          <button @click="stopStopwatch" :disabled="!stopwatchState.isRunning">Stop</button>
          <button @click="resetStopwatch" :disabled="stopwatchState.isRunning">Reset</button>
        </div>
      </div>
    </div>

    <div v-if="tag">
      <h1>{{ tag.name }}</h1>
      <p>부모 태그:
        <router-link v-if="tag.parentId" :to="'/api/tag/detail/' + tag.parentId">부모 태그 보기</router-link>
        <span v-else>식별 안됨</span>
      </p>
      <h3>하위 태그</h3>
      <!-- 자식 태그 리스트 표시 -->
      <ul v-if="tag.childrenList && tag.childrenList.length > 0">
        <li v-for="childId in tag.childrenList" :key="childId">
          <router-link :to="'/api/tag/detail/' + childId">{{ childId }}</router-link>
        </li>
      </ul>
      <router-link to="/">홈으로</router-link>
    </div>

    <p v-else>로딩 중...</p>
  </div>
</template>

<script setup>
// import {ref, onMounted, watch} from "vue";
import {ref, onMounted, watch, reactive, watchEffect, computed} from "vue";
import { useRoute } from "vue-router";
import { Menu } from "lucide-vue-next";
import axios from "axios";
import TagModal from "@/Modals/EditTagModal.vue";

const route = useRoute();
const tag = ref(null);

const isModalOpen = ref(false); // 모달 상태 관리

const fetchTagData = async (tagId) => {
  try {
    const response = await axios.get(`/api/tag/detail/${tagId}`);
    tag.value = response.data;
    console.log("서버로부터 받아온 태그 데이터", tag.value);

    stopwatchState.isRunning = tag.value.state || false;
    stopwatchState.latestStartTime = tag.value.latestStartTime;
    stopwatchState.latestEndTime = tag.value.latestEndTime;
    stopwatchState.elapsedTime = tag.value.elapsedTime;
    stopwatchState.dailyTotalTime = tag.value.dailyTotalTime;
    stopwatchState.dailyGoalTime = tag.value.dailyGoalTime;
    stopwatchState.tagTotalTime = tag.value.tagTotalTime;
    stopwatchState.totalTime = tag.value.totalTime;

    stopwatchState.elapsedTimeCal = tag.value.elapsedTime;
    stopwatchState.dailyTotalTimeCal = tag.value.dailyTotalTime;
    stopwatchState.tagTotalTimeCal = tag.value.tagTotalTime;
    stopwatchState.totalTimeCal = tag.value.totalTime;


  } catch (error) {
    console.error("태그 데이터를 불러오는 중 오류 발생:", error);
  }
};

const stopwatchState = reactive({
  isRunning: false,
  latestStartTime: 0,
  latestEndTime: 0,
  elapsedTime: 0,
  dailyTotalTime: 0,
  dailyGoalTime: 0,
  tagTotalTime: 0,
  totalTime: 0,
  rAF_ID: 0,

  elapsedTimeCal: 0, // timer에 나타나는 시간
  dailyTotalTimeCal: 0, // dailyTotalTime 나타내는 시간
  tagTotalTimeCal: 0,
  totalTimeCal: 0,
})

// 1970년 1월 1일이면 "No Data", 아니면 변환된 날짜 표시
const formattedStartTime = ref("No Data");
const formattedEndTime = ref("No Data");

watchEffect(() => {
  console.log("Stopwatch latestStartTime Updated:", stopwatchState.latestStartTime);
  if (!stopwatchState || !stopwatchState.latestStartTime) return;
  const date = new Date(stopwatchState.latestStartTime);
  formattedStartTime.value = date.getFullYear() === 1970 ? "No Data" : date.toLocaleTimeString();
});

watchEffect(() => {
  console.log("Stopwatch latestStopTime Updated:", stopwatchState.latestStartTime);
  if (!stopwatchState || !stopwatchState.latestEndTime) return;
  const date = new Date(stopwatchState.latestEndTime);
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
const formattedElapsedTime = computed(() => formatTime(stopwatchState.elapsedTimeCal));
const formattedDailyTotalTime = computed(() => formatTime(stopwatchState.dailyTotalTimeCal));
const dailyGoalTime = computed(() => stopwatchState.dailyGoalTime || 0);
const formattedRemainingTime = computed(() => {
  const remainingTime = dailyGoalTime.value - stopwatchState.dailyTotalTimeCal;
  return `+${formatTime(Math.max(0, remainingTime))}`;
});
// 할 것 얘내 연산 해주기
const formattedTagTotalTime = computed(() => formatTime(stopwatchState.tagTotalTimeCal));
const formattedTotalTime = computed(() => formatTime(stopwatchState.totalTimeCal));

// ✅ 스톱워치 업데이트 (애니메이션 프레임)
const updateTimer = () => {
  if (!stopwatchState.latestStartTime) return;

  const currentTime = Date.now();
  const deltaTime = Math.floor((currentTime - stopwatchState.latestStartTime) / 1000);
  stopwatchState.elapsedTimeCal = deltaTime + stopwatchState.elapsedTime;
  stopwatchState.dailyTotalTimeCal = stopwatchState.dailyTotalTime + deltaTime; // 정상 작동 하나 확인 필요

  stopwatchState.tagTotalTimeCal = stopwatchState.tagTotalTime + deltaTime; // 얘 고쳐야 함 축척시간이 더해져서 뻥튀기됨
  console.log("태그토탈타임 체크 tagTotalTime : " + stopwatchState.tagTotalTime + " accumulatedTime : " + stopwatchState.dailyTotalTimeCal)
  stopwatchState.totalTimeCal = stopwatchState.totalTime + deltaTime;

  stopwatchState.rAF_ID = requestAnimationFrame(updateTimer);
};

// ✅ 스톱워치 시작
const startStopwatch = async () => {
  if (stopwatchState.isRunning) return;
  console.log("before start dailyTotalTime : " + stopwatchState.dailyTotalTime)
  stopwatchState.isRunning = true;
  stopwatchState.latestStartTime = Date.now();

  console.log("Updated latestStartTime:", stopwatchState.latestStartTime);
  console.log("startStopwatch isRunning: ", stopwatchState.isRunning);
  updateTimer();
  // stopwatch.latestStartTime = new Date(stopwatch.latestStartTime).toLocaleTimeString();
  // stopwatch.latestStartTime = new Date(stopwatch.latestStartTime).toISOString();
  console.log("after start dailyTotalTime : " + stopwatchState.dailyTotalTime)

  console.log("start id prop : " + tag.value.id);

  try {
    await axios.post(`/api/tag/${tag.value.id}/start`, new Date(stopwatchState.latestStartTime).toISOString(), {
      headers: {"Content-Type": "application/json"},
    });
  } catch (error) {
    console.error("스톱워치 시작 실패:", error);
  }
};

// ✅ 스톱워치 종료
const stopStopwatch = async () => {
  if (!stopwatchState.isRunning) return;
  console.log("before end dailyTotalTime : " + stopwatchState.dailyTotalTime)
  stopwatchState.isRunning = false;
  cancelAnimationFrame(stopwatchState.rAF_ID);
  // stopwatch.endTime = new Date().toLocaleTimeString();
  console.log("after end dailyTotalTime : " + stopwatchState.dailyTotalTime)
  stopwatchState.latestEndTime = Date.now();
  const delta = Math.floor(stopwatchState.latestEndTime - stopwatchState.latestStartTime) / 1000
  stopwatchState.elapsedTime += delta;
  stopwatchState.dailyTotalTime += delta;
  stopwatchState.tagTotalTime += delta;
  stopwatchState.totalTime += delta;

  console.log("before end cal dailyTotalTime : " + stopwatchState.dailyTotalTime)
  console.log("id : " + stopwatchState.id + "id in props : " + tag.value.id)

  console.log("before end cal dailyTotalTime : " + stopwatchState.dailyTotalTime)
  console.log("id : " + stopwatchState.id + "id in props : " + tag.value.id)
  try {
    await axios.post(
        `/api/record/${tag.value.id}/stop`,
        {elapsedTime: stopwatchState.elapsedTime,
          timestamps: {
            startTime: new Date(stopwatchState.latestStartTime).toISOString(),
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
  if (stopwatchState.isRunning) return;
  stopwatchState.elapsedTimeCal = 0;
  stopwatchState.elapsedTime = 0;

  try {
    await axios.post(
        `/api/tag/${tag.value.id}/reset`,
        {elapsedTime: stopwatchState.elapsedTime,
        },
        {headers: {"Content-Type": "application/json"}}
    );
  } catch (error) {
    console.error("스톱워치 종료 실패:", error);
  }

};


// ✅ `history.state`에서 태그 데이터 가져오기
// TagDetail.vue에서 history.state.tag가 없을 경우 서버에서 재요청, 이렇게 하면 URL로 직접 접근했을 때도 정상적으로 데이터를 불러올 수 있음
onMounted( () => {
  console.log("onMount2")
  if (history.state.tag) {
    tag.value = history.state.tag;
    console.log("컴포턴트 히스토리 에서 받아온 정보", tag.value)
} else {
    try {
      const response = axios.get(`/api/tag/detail/${route.params.id}`);
      tag.value = response.data;
      console.log("서버로 부터 받아온 태그 데이터", tag.value)
    } catch (error) {
      console.error("태그 데이터를 불러오는 중 오류 발생:", error);
    }
  }

  // 처음 페이지가 로드될 때, history.state.tag가 있을 경우 그 데이터를 사용하고, 없으면 라우터에서 tag.id를 받아와 데이터를 요청함.
  onMounted(() => {
    console.log("onMount3")
    if (history.state.tag) {
      tag.value = history.state.tag;
      console.log("컴포넌트 히스토리에서 받아온 정보", tag.value);
    } else {
      fetchTagData(route.params.id);
    }



  });
// ✅ `watch`를 사용하여 라우터 파라미터 변경 시 데이터 갱신
// route.params.id를 감시하여 라우터 ID가 변경될 때마다 fetchTagData()를 호출해 새로운 데이터를 요청함. (변경됨)
// ✅ `watch`에서 특정 페이지(`/tag/:id`)일 때만 데이터 갱신
  watch(
      () => route.params.id,  // 라우터 ID가 변경될 때
      (newId, oldId) => {
        console.log("🔄 라우터 ID 변경됨:", oldId, "->", newId);
        fetchTagData(newId); // 새로운 ID로 데이터를 다시 불러옴
      },
      { immediate: true }
  );
});
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