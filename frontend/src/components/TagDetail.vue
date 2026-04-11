<template>
  <div class="page detail-page" :class="{ 'is-running': stopwatchState.isRunning }">

    <!-- Topbar -->
    <div class="topbar">
      <router-link :to="`/members/${tag?.memberId ?? 1}/tags`" class="topbar-back">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M10.5 6.5h-8M6 3L2.5 6.5 6 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Tags
      </router-link>
      <button class="manage-btn" @click="isModalOpen = true" title="Manage tag">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="3.5"  r="1.1" fill="currentColor"/>
          <circle cx="8" cy="8"   r="1.1" fill="currentColor"/>
          <circle cx="8" cy="12.5" r="1.1" fill="currentColor"/>
        </svg>
      </button>
      <TagModal v-if="isModalOpen" :isOpen="isModalOpen" :tagData="tag" @close="isModalOpen = false" />
    </div>

    <!-- Content -->
    <div v-if="tag" class="detail-content">

      <!-- ── Tag Identity ── -->
      <section class="tag-identity">
        <div class="tag-meta-row">
          <span class="tag-type mono">{{ tag.type }}</span>
          <div class="tag-status-badge" :class="{ running: stopwatchState.isRunning }">
            <span class="dot" :class="stopwatchState.isRunning ? 'running' : 'stopped'"></span>
            <span class="status-label mono">{{ stopwatchState.isRunning ? 'live' : 'paused' }}</span>
          </div>
        </div>
        <h1 class="tag-title">{{ tag.name }}</h1>
        <div class="tag-breadcrumb" v-if="tag.parentId">
          <router-link :to="'/tags/' + tag.parentId" class="parent-link">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M8.5 5.5H2.5M5 2.5L2.5 5.5 5 8.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            parent tag
          </router-link>
        </div>
      </section>

      <!-- ── Timer Hero ── -->
      <section class="timer-section">
        <div class="timer-wrap">
          <div class="timer-display" :class="{ 'timer-active': stopwatchState.isRunning }">
            {{ formattedElapsedTime }}
          </div>
          <span class="timer-unit mono">elapsed</span>
        </div>

        <!-- Daily progress bar -->
        <div class="daily-progress" v-if="dailyGoalTime > 0">
          <div class="progress-track">
            <div
              class="progress-fill"
              :style="{ width: Math.min(100, (stopwatchState.dailyTotalTimeCal / dailyGoalTime) * 100) + '%' }"
            ></div>
          </div>
          <div class="progress-labels">
            <span class="mono">{{ formattedDailyTotalTime }}</span>
            <span class="mono progress-sep">/ {{ formatTime(dailyGoalTime) }}</span>
          </div>
        </div>
      </section>

      <!-- ── Controls ── -->
      <section class="controls-section">
        <button
          class="ctrl-btn ctrl-start"
          :class="{ active: !stopwatchState.isRunning }"
          @click="startStopwatch"
          :disabled="stopwatchState.isRunning"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 1.5l7.5 4.5L3 10.5V1.5z" fill="currentColor"/>
          </svg>
          Start
        </button>
        <button
          class="ctrl-btn ctrl-stop"
          :class="{ active: stopwatchState.isRunning }"
          @click="stopStopwatch"
          :disabled="!stopwatchState.isRunning"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="1.5" y="1.5" width="7" height="7" rx="1" fill="currentColor"/>
          </svg>
          Stop
        </button>
        <button
          class="ctrl-btn ctrl-reset"
          @click="resetStopwatch"
          :disabled="stopwatchState.isRunning"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1.5 6A4.5 4.5 0 1 0 6 1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <path d="M1.5 1.5v4.5h4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Reset
        </button>
      </section>

      <!-- ── Push Notification ── -->
      <section class="notify-section" v-if="isPushSupported">
        <button
          class="notify-btn"
          :class="{ subscribed: isPushSubscribed }"
          @click="togglePushNotification"
          :title="isPushSubscribed ? '알림 끄기' : '알림 켜기'"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path
              v-if="!isPushSubscribed"
              d="M6.5 1.5a4 4 0 0 1 4 4v2.5l.8 1.5H1.7l.8-1.5V5.5a4 4 0 0 1 4-4zM5 10.5a1.5 1.5 0 0 0 3 0"
              stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"
            />
            <path
              v-else
              d="M6.5 1.5a4 4 0 0 1 4 4v2.5l.8 1.5H1.7l.8-1.5V5.5a4 4 0 0 1 4-4zM5 10.5a1.5 1.5 0 0 0 3 0M1.5 1.5l10 10"
              stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"
            />
          </svg>
          <span class="mono">{{ isPushSubscribed ? 'Notifications on' : 'Notify me' }}</span>
        </button>
      </section>

      <!-- ── Stats Grid ── -->
      <section class="stats-grid">
        <div class="stat-cell">
          <span class="stat-label mono">daily total</span>
          <span class="stat-val mono">{{ formattedDailyTotalTime }}</span>
        </div>
        <div class="stat-cell" v-if="dailyGoalTime > 0">
          <span class="stat-label mono">remaining</span>
          <span class="stat-val mono">{{ formattedRemainingTime }}</span>
        </div>
        <div class="stat-cell">
          <span class="stat-label mono">tag total</span>
          <span class="stat-val mono">{{ formattedTagTotalTime }}</span>
        </div>
        <div class="stat-cell">
          <span class="stat-label mono">all time</span>
          <span class="stat-val mono">{{ formattedTotalTime }}</span>
        </div>
        <div class="stat-cell">
          <span class="stat-label mono">started</span>
          <span class="stat-val mono">{{ formattedStartTime || '—' }}</span>
        </div>
        <div class="stat-cell">
          <span class="stat-label mono">stopped</span>
          <span class="stat-val mono">{{ formattedEndTime || '—' }}</span>
        </div>
      </section>

      <div class="divider"></div>

      <!-- ── Bottom: Sub-tags + Records ── -->
      <section class="bottom-section">
        <div class="sub-tags" v-if="tag.childrenList && tag.childrenList.length > 0">
          <p class="section-eyebrow mono">Sub-tags</p>
          <div class="sub-tag-list">
            <router-link
              v-for="childId in tag.childrenList"
              :key="childId"
              :to="'/tags/' + childId"
              class="sub-tag-chip mono"
            >
              {{ childId }}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M3 2l4 3-4 3" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
              </svg>
            </router-link>
          </div>
        </div>

        <div class="records-nav">
          <p class="section-eyebrow mono">Sessions</p>
          <button class="records-link-btn" @click="goToRecordsPage(tag.id)">
            View all records
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2.5 6.5h8M7 3l3.5 3.5L7 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </section>

    </div>

    <!-- Loading -->
    <div v-else class="loading-state">
      <span class="dot stopped"></span>
      <span class="mono">Loading…</span>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, reactive, watchEffect, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import TagModal from '@/Modals/EditTagModal.vue';
import { subscribePush, unsubscribePush, getCurrentSubscription } from '@/utils/push.js';
import { saveTimerState, loadTimerState, clearTimerState } from '@/utils/timerPersistence.js';

const route = useRoute();
const tag = ref(null);
const router = useRouter();
const isModalOpen = ref(false);

// ── Wake Lock (prevent screen sleep while timer is running) ──
const wakeLock = ref(null);

const requestWakeLock = async () => {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock.value = await navigator.wakeLock.request('screen');
    wakeLock.value.addEventListener('release', () => { wakeLock.value = null; });
  } catch (e) {
    console.warn('Wake Lock 요청 실패:', e);
  }
};

const releaseWakeLock = async () => {
  if (wakeLock.value) {
    await wakeLock.value.release();
    wakeLock.value = null;
  }
};

const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible' && stopwatchState.isRunning) {
    requestWakeLock();
  }
};

document.addEventListener('visibilitychange', handleVisibilityChange);

// Push notification state
const isPushSubscribed = ref(false);
const isPushSupported = 'serviceWorker' in navigator && 'PushManager' in window;

onMounted(async () => {
  const sub = await getCurrentSubscription();
  isPushSubscribed.value = !!sub;
});

const togglePushNotification = async () => {
  if (!tag.value) return;
  if (isPushSubscribed.value) {
    await unsubscribePush(tag.value.memberId);
    isPushSubscribed.value = false;
  } else {
    const result = await subscribePush(tag.value.memberId);
    isPushSubscribed.value = result === 'subscribed';
  }
};

const goToRecordsPage = (tagId) => router.push(`/records/${tagId}`);

const hydrateStopwatchState = () => {
  stopwatchState.elapsedTimeCal    = stopwatchState.elapsedTime;
  stopwatchState.dailyTotalTimeCal = stopwatchState.dailyTotalTime;
  stopwatchState.tagTotalTimeCal   = stopwatchState.tagTotalTime;
  stopwatchState.totalTimeCal      = stopwatchState.totalTime;

  if (stopwatchState.isRunning && stopwatchState.latestStartTime > 0) {
    cancelAnimationFrame(stopwatchState.rAF_ID);
    updateTimer();
    requestWakeLock();
  }
};

const fetchTagData = async (tagId) => {
  const saved = loadTimerState(Number(tagId));

  try {
    const response = await apiClient.get(`/api/v1/tags/${tagId}`);
    tag.value = response.data;

    // 로컬에 저장된 타이머 상태가 서버/캐시 응답보다 최신이면 로컬 우선
    // (오프라인에서 타이머 조작 후, SW 캐시가 오래된 응답을 반환하는 경우)
    if (saved && saved.savedAt > (tag.value.latestStartTimeMs || 0)) {
      stopwatchState.isRunning       = saved.isRunning;
      stopwatchState.latestStartTime = saved.latestStartTime;
      stopwatchState.latestEndTime   = saved.latestEndTime;
      stopwatchState.elapsedTime     = saved.elapsedTime;
      stopwatchState.dailyTotalTime  = saved.dailyTotalTime;
      stopwatchState.dailyGoalTime   = saved.dailyGoalTime || tag.value.dailyGoalTime || 0;
      stopwatchState.tagTotalTime    = saved.tagTotalTime;
      stopwatchState.totalTime       = saved.totalTime;
    } else {
      // 서버 데이터가 최신 → 정상 반영
      stopwatchState.isRunning        = tag.value.state || false;
      stopwatchState.latestStartTime  = tag.value.latestStartTimeMs || 0;
      stopwatchState.latestEndTime    = tag.value.latestStopTimeMs || 0;
      stopwatchState.elapsedTime      = tag.value.elapsedTime || 0;
      stopwatchState.dailyTotalTime   = tag.value.dailyTotalTime || 0;
      stopwatchState.dailyGoalTime    = tag.value.dailyGoalTime || 0;
      stopwatchState.tagTotalTime     = tag.value.tagTotalTime || 0;
      stopwatchState.totalTime        = tag.value.totalTime || 0;
      clearTimerState();
    }

    hydrateStopwatchState();
  } catch (error) {
    console.error('태그 데이터를 불러오는 중 오류 발생:', error);
    // 완전한 네트워크 실패 (SW 캐시도 없는 경우)
    if (saved) {
      tag.value = tag.value || { id: Number(tagId), name: '...', memberId: null };
      stopwatchState.isRunning       = saved.isRunning;
      stopwatchState.latestStartTime = saved.latestStartTime;
      stopwatchState.latestEndTime   = saved.latestEndTime;
      stopwatchState.elapsedTime     = saved.elapsedTime;
      stopwatchState.dailyTotalTime  = saved.dailyTotalTime;
      stopwatchState.dailyGoalTime   = saved.dailyGoalTime;
      stopwatchState.tagTotalTime    = saved.tagTotalTime;
      stopwatchState.totalTime       = saved.totalTime;
      hydrateStopwatchState();
    }
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
  elapsedTimeCal: 0,
  dailyTotalTimeCal: 0,
  tagTotalTimeCal: 0,
  totalTimeCal: 0,
});

const formattedStartTime = ref('—');
const formattedEndTime   = ref('—');

watchEffect(() => {
  if (!stopwatchState?.latestStartTime) return;
  const date = new Date(stopwatchState.latestStartTime);
  formattedStartTime.value = date.getFullYear() === 1970 ? '—' : date.toLocaleTimeString();
});

watchEffect(() => {
  if (!stopwatchState?.latestEndTime) return;
  const date = new Date(stopwatchState.latestEndTime);
  formattedEndTime.value = date.getFullYear() === 1970 ? '—' : date.toLocaleTimeString();
});

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00:00';
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const formattedElapsedTime    = computed(() => formatTime(stopwatchState.elapsedTimeCal));
const formattedDailyTotalTime = computed(() => formatTime(stopwatchState.dailyTotalTimeCal));
const dailyGoalTime           = computed(() => stopwatchState.dailyGoalTime || 0);
const formattedRemainingTime  = computed(() => {
  const r = dailyGoalTime.value - stopwatchState.dailyTotalTimeCal;
  return formatTime(Math.max(0, r));
});
const formattedTagTotalTime = computed(() => formatTime(stopwatchState.tagTotalTimeCal));
const formattedTotalTime    = computed(() => formatTime(stopwatchState.totalTimeCal));

const updateTimer = () => {
  if (stopwatchState.latestStartTime <= 0) return;
  const currentTime = Date.now();
  const deltaTime = Math.floor((currentTime - stopwatchState.latestStartTime) / 1000);
  if (deltaTime < 0) return;
  stopwatchState.elapsedTimeCal    = deltaTime + stopwatchState.elapsedTime;
  stopwatchState.dailyTotalTimeCal = stopwatchState.dailyTotalTime + deltaTime;
  stopwatchState.tagTotalTimeCal   = stopwatchState.tagTotalTime + deltaTime;
  stopwatchState.totalTimeCal      = stopwatchState.totalTime + deltaTime;
  stopwatchState.rAF_ID = requestAnimationFrame(updateTimer);
};

const startStopwatch = async () => {
  if (stopwatchState.isRunning) return;
  stopwatchState.isRunning       = true;
  stopwatchState.latestStartTime = Date.now();
  updateTimer();
  requestWakeLock();
  saveTimerState(tag.value.id, stopwatchState);
  try {
    await apiClient.post(
      `/api/v1/tags/${tag.value.id}/timer/start`,
      { startTime: new Date(stopwatchState.latestStartTime).toISOString() },
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // BackgroundSync가 온라인 복귀 시 자동 재전송
    console.warn('스톱워치 시작 요청 큐잉됨 (오프라인):', error.message);
  }
};

const stopStopwatch = async () => {
  if (!stopwatchState.isRunning) return;
  stopwatchState.isRunning = false;
  cancelAnimationFrame(stopwatchState.rAF_ID);
  releaseWakeLock();
  stopwatchState.latestEndTime = Date.now();
  const delta = Math.floor((stopwatchState.latestEndTime - stopwatchState.latestStartTime) / 1000);
  stopwatchState.elapsedTime    += delta;
  stopwatchState.dailyTotalTime += delta;
  stopwatchState.tagTotalTime   += delta;
  stopwatchState.totalTime      += delta;
  stopwatchState.elapsedTimeCal    = stopwatchState.elapsedTime;
  stopwatchState.dailyTotalTimeCal = stopwatchState.dailyTotalTime;
  stopwatchState.tagTotalTimeCal   = stopwatchState.tagTotalTime;
  stopwatchState.totalTimeCal      = stopwatchState.totalTime;
  saveTimerState(tag.value.id, stopwatchState);
  try {
    await apiClient.post(
      `/api/v1/tags/${tag.value.id}/timer/stop`,
      {
        elapsedTime: stopwatchState.elapsedTime,
        timestamps: {
          startTime: new Date(stopwatchState.latestStartTime).toISOString(),
          endTime:   new Date(stopwatchState.latestEndTime).toISOString(),
        },
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    clearTimerState();
  } catch (error) {
    // BackgroundSync가 온라인 복귀 시 자동 재전송
    console.warn('스톱워치 종료 요청 큐잉됨 (오프라인):', error.message);
  }
};

const resetStopwatch = async () => {
  if (stopwatchState.isRunning) return;
  stopwatchState.elapsedTimeCal = 0;
  stopwatchState.elapsedTime    = 0;
  saveTimerState(tag.value.id, stopwatchState);
  try {
    await apiClient.post(
      `/api/v1/tags/${tag.value.id}/timer/reset`,
      { elapsedTime: stopwatchState.elapsedTime },
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // BackgroundSync가 온라인 복귀 시 자동 재전송
    console.warn('스톱워치 리셋 요청 큐잉됨 (오프라인):', error.message);
  }
};

watch(
  () => route.params.id,
  (newId) => {
    if (newId) {
      cancelAnimationFrame(stopwatchState.rAF_ID);
      fetchTagData(newId);
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  cancelAnimationFrame(stopwatchState.rAF_ID);
  releaseWakeLock();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});
</script>

<style scoped>
/* ── Running State Tint ── */
.detail-page { position: relative; }

.detail-page.is-running::before {
  content: '';
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: var(--running);
  box-shadow: 0 0 20px var(--running);
  animation: scan 3s ease infinite;
}

@keyframes scan {
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1; }
}

/* ── Topbar extras ── */
.manage-btn {
  background: transparent;
  color: var(--text-2);
  padding: 6px;
  border-radius: var(--radius);
  transition: color var(--t);
  display: flex; align-items: center;
}
.manage-btn:hover { color: var(--text); }

/* ── Tag Identity ── */
.tag-identity { padding: 44px 0 36px; }

.tag-meta-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;
}

.tag-type {
  font-size: 10px;
  color: var(--text-3);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.tag-status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  border-radius: 20px;
  border: 1px solid var(--border);
  transition: all var(--t);
}

.tag-status-badge.running {
  border-color: rgba(111, 207, 151, 0.2);
  background: var(--running-dim);
}

.status-label {
  font-size: 10px;
  color: var(--text-2);
  letter-spacing: 0.1em;
}

.tag-status-badge.running .status-label { color: var(--running); }

.tag-title {
  font-family: var(--font-serif);
  font-size: clamp(32px, 5vw, 48px);
  color: var(--text);
  font-weight: 400;
  line-height: 1.1;
  margin-bottom: 14px;
}

.tag-breadcrumb { margin-top: 4px; }

.parent-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-2);
  transition: color var(--t);
}
.parent-link:hover { color: var(--accent); }

/* ── Timer Hero ── */
.timer-section {
  padding: 16px 0 40px;
  border-top: 1px solid var(--border-subtle);
  border-bottom: 1px solid var(--border-subtle);
}

.timer-wrap {
  display: flex;
  align-items: baseline;
  gap: 16px;
  margin-bottom: 28px;
}

.timer-display {
  font-family: var(--font-mono);
  font-size: clamp(52px, 10vw, 86px);
  font-weight: 400;
  color: var(--text-2);
  letter-spacing: -0.02em;
  line-height: 1;
  transition: color 400ms ease, text-shadow 400ms ease;
  user-select: none;
}

.timer-display.timer-active {
  color: var(--text);
  text-shadow: 0 0 40px rgba(222, 218, 211, 0.08);
}

.timer-unit {
  font-size: 11px;
  color: var(--text-3);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  align-self: flex-end;
  padding-bottom: 10px;
}

/* Progress bar */
.daily-progress { }

.progress-track {
  height: 1px;
  background: var(--border);
  border-radius: 1px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 1px;
  transition: width 1s linear;
}

.progress-labels {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--text-2);
}

.progress-sep { color: var(--text-3); }

/* ── Controls ── */
.controls-section {
  display: flex;
  gap: 10px;
  padding: 32px 0;
}

.ctrl-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 20px;
  height: 38px;
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.07em;
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text-2);
  border: 1px solid var(--border);
  transition: all var(--t);
}

.ctrl-btn:hover:not(:disabled) {
  border-color: var(--text-3);
  color: var(--text);
}

.ctrl-btn:active:not(:disabled) { transform: scale(0.97); }

.ctrl-btn:disabled { opacity: 0.25; cursor: not-allowed; transform: none; }

/* Active state variations */
.ctrl-start.active {
  background: var(--accent-dim);
  border-color: rgba(201, 169, 110, 0.25);
  color: var(--accent);
}
.ctrl-start.active:hover {
  background: rgba(201, 169, 110, 0.14);
  color: var(--accent);
}

.ctrl-stop.active {
  background: var(--running-dim);
  border-color: rgba(111, 207, 151, 0.2);
  color: var(--running);
}
.ctrl-stop.active:hover {
  color: var(--running);
}

/* ── Notify ── */
.notify-section {
  padding: 0 0 20px;
}

.notify-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 16px;
  height: 32px;
  font-size: 11px;
  letter-spacing: 0.07em;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-3);
  border: 1px solid var(--border-subtle);
  transition: all var(--t);
}

.notify-btn:hover {
  color: var(--text-2);
  border-color: var(--border);
}

.notify-btn.subscribed {
  color: var(--accent);
  border-color: rgba(201, 169, 110, 0.2);
  background: var(--accent-dim);
}

/* ── Stats Grid ── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  padding: 28px 0;
}

.stat-cell {
  padding: 16px 0;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.stat-cell:nth-child(n+4) { border-bottom: none; }

.stat-label {
  font-size: 10px;
  color: var(--text-3);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.stat-val {
  font-size: 15px;
  color: var(--text-2);
}

/* ── Bottom section ── */
.bottom-section {
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding-bottom: 60px;
}

.section-eyebrow {
  font-size: 10px;
  color: var(--text-3);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin-bottom: 14px;
}

.sub-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sub-tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 11px;
  color: var(--text-2);
  transition: all var(--t);
}

.sub-tag-chip:hover {
  color: var(--text);
  border-color: var(--text-3);
}

.records-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 400;
  padding: 0;
  transition: color var(--t);
}

.records-link-btn:hover { color: var(--accent); }
.records-link-btn:hover svg path { stroke: var(--accent); }

/* ── Loading ── */
.loading-state {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 80px 0;
  color: var(--text-2);
  font-size: 13px;
}

.mono { font-family: var(--font-mono); }
</style>
