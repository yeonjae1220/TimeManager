<template>
  <AppShell :isRunning="stopwatchState.isRunning">
    <div class="page today-page" :class="{ 'is-running': stopwatchState.isRunning }">

      <!-- Running tint line -->
      <div class="running-line" v-if="stopwatchState.isRunning"></div>

      <!-- Offline banner -->
      <div v-if="!isOnline" class="offline-banner">
        <span class="mono">오프라인 — 복귀 후 자동 동기화됩니다</span>
      </div>

      <!-- Topbar -->
      <div class="topbar">
        <span class="topbar-brand">timemgr</span>
        <span class="topbar-date mono">{{ todayLabel }}</span>
      </div>

      <!-- Tag selector -->
      <section class="tag-selector-section">
        <p class="section-eyebrow mono">recording</p>
        <button class="tag-selector-btn" @click="showTagPicker = !showTagPicker">
          <span class="selector-dot" :class="stopwatchState.isRunning ? 'running' : 'stopped'"></span>
          <span class="selector-name">{{ tag?.name ?? '태그를 선택하세요' }}</span>
          <svg class="selector-chevron" :class="{ open: showTagPicker }" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <!-- Tag picker dropdown -->
        <div v-if="showTagPicker" class="tag-picker">
          <div class="tag-picker-scroll">
            <button
              v-for="t in flatTagList"
              :key="t.id"
              class="tag-picker-item"
              :class="{ selected: t.id === tag?.id, running: t.state }"
              @click="selectTag(t.id)"
            >
              <span class="picker-indent" :style="{ width: (t.depth * 14) + 'px' }"></span>
              <span class="picker-dot" :class="t.state ? 'running' : 'stopped'"></span>
              <span class="picker-name">{{ t.name }}</span>
              <span class="picker-daily mono">{{ formatTime(t.dailyTotalTime || 0) }}</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Timer hero -->
      <section class="timer-section" v-if="tag">
        <div class="timer-wrap">
          <div class="timer-display" :class="{ 'timer-active': stopwatchState.isRunning }">
            {{ formattedElapsedTime }}
          </div>
          <span class="timer-unit mono">elapsed</span>
        </div>
      </section>
      <section class="timer-section timer-empty" v-else>
        <div class="timer-display timer-placeholder mono">— — : — —</div>
        <p class="empty-hint mono">위에서 태그를 선택하면 타이머가 시작됩니다</p>
      </section>

      <!-- Controls -->
      <section class="controls-section">
        <button
          class="ctrl-btn ctrl-start"
          :class="{ active: tag && !stopwatchState.isRunning }"
          @click="startStopwatch"
          :disabled="!tag || stopwatchState.isRunning || isSwitching"
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
          :disabled="!tag || stopwatchState.isRunning"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1.5 6A4.5 4.5 0 1 0 6 1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <path d="M1.5 1.5v4.5h4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Reset
        </button>
      </section>

      <!-- Totals row -->
      <section class="totals-section" v-if="tag">
        <div class="totals-row">
          <div class="total-cell">
            <span class="total-label mono">today</span>
            <span class="total-val mono">{{ formattedTodayTotal }}</span>
          </div>
          <div class="total-sep"></div>
          <div class="total-cell">
            <span class="total-label mono">tag today</span>
            <span class="total-val mono">{{ formattedDailyTotalTime }}</span>
          </div>
          <div class="total-sep"></div>
          <div class="total-cell">
            <span class="total-label mono">tag total</span>
            <span class="total-val mono">{{ formattedTagTotalTime }}</span>
          </div>
        </div>
      </section>

      <!-- Stats grid -->
      <section class="stats-grid" v-if="tag">
        <div class="stat-cell">
          <span class="stat-label mono">daily total</span>
          <span class="stat-val mono">{{ formattedDailyTotalTime }}</span>
        </div>
        <div class="stat-cell" v-if="dailyGoalTime > 0">
          <span class="stat-label mono">remaining</span>
          <span class="stat-val mono">{{ formattedRemainingTime }}</span>
        </div>
        <div class="stat-cell">
          <span class="stat-label mono">all time</span>
          <span class="stat-val mono">{{ formattedTotalTime }}</span>
        </div>
        <div class="stat-cell">
          <span class="stat-label mono">started</span>
          <span class="stat-val mono">{{ formattedStartTime }}</span>
        </div>
        <div class="stat-cell">
          <span class="stat-label mono">stopped</span>
          <span class="stat-val mono">{{ formattedEndTime }}</span>
        </div>
      </section>

      <!-- Sessions + Push notification -->
      <section class="actions-section" v-if="tag">
        <div class="divider"></div>
        <div class="actions-row">
          <button class="sessions-btn" @click="goToRecords">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x="2" y="2" width="9" height="9" rx="1" stroke="currentColor" stroke-width="1.1"/>
              <path d="M4.5 5.5h4M4.5 7.5h2.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
            </svg>
            <span class="mono">Sessions</span>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M2 5.5h7M6 2.5L9 5.5 6 8.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>

          <button
            v-if="isPushSupported"
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
        </div>
      </section>

      <!-- Today by tag breakdown -->
      <section class="breakdown-section" v-if="flatTagList.length">
        <p class="section-eyebrow mono">today by tag</p>
        <ul class="breakdown-list">
          <li
            v-for="t in flatTagList.filter(t => t.dailyTotalTime > 0 || t.state)"
            :key="t.id"
            class="breakdown-item"
            :class="{ 'breakdown-item--active': t.id === tag?.id }"
            @click="selectTag(t.id)"
          >
            <span class="breakdown-dot" :class="t.state ? 'running' : 'stopped'"></span>
            <span class="breakdown-indent" :style="{ width: (t.depth * 10) + 'px' }"></span>
            <span class="breakdown-name">{{ t.name }}</span>
            <span class="breakdown-time mono">
              {{ t.id === tag?.id
                  ? formatTime(stopwatchState.dailyTotalTimeCal)
                  : formatTime(t.dailyTotalTime || 0) }}
            </span>
          </li>
        </ul>
      </section>

    </div>
  </AppShell>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppShell from '@/components/layout/AppShell.vue';
import { useTagStore } from '@/stores/tagStore';
import { useNetworkStatus } from '@/composables/useNetworkStatus';
import { useLiveIndicator } from '@/composables/useLiveIndicator';
import { useTagTimer } from '@/composables/useTagTimer';
import { peekTimerState } from '@/utils/timerPersistence';
import { subscribePush, unsubscribePush, getCurrentSubscription } from '@/utils/push.js';

const route    = useRoute();
const router   = useRouter();
const memberId = computed(() => route.params.id);
const tagStore = useTagStore();
const { isOnline } = useNetworkStatus();
const { startLive, stopLive } = useLiveIndicator();

const {
  tag,
  stopwatchState,
  loadTag,
  startStopwatch: _startStopwatch,
  stopStopwatch:  _stopStopwatch,
  resetStopwatch: _resetStopwatch,
  cleanup: timerCleanup,
  getPendingStop,
  formatTime,
  formattedStartTime,
  formattedEndTime,
  formattedElapsedTime,
  formattedDailyTotalTime,
  dailyGoalTime,
  formattedRemainingTime,
  formattedTagTotalTime,
  formattedTotalTime,
} = useTagTimer();

const showTagPicker  = ref(false);
const isSwitching    = ref(false);
const wakeLock       = ref(null);
const isPushSubscribed = ref(false);
const isPushSupported  = 'serviceWorker' in navigator && 'PushManager' in window;

// ── Today label ──
const todayLabel = computed(() => {
  return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
});

// ── Wake Lock ──
const requestWakeLock = async () => {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock.value = await navigator.wakeLock.request('screen');
    wakeLock.value.addEventListener('release', () => { wakeLock.value = null; });
  } catch (e) { /* not supported or permission denied — non-critical */ }
};

const releaseWakeLock = async () => {
  if (wakeLock.value) { await wakeLock.value.release(); wakeLock.value = null; }
};

// ── Controls ──
const startStopwatch = async () => {
  await _startStopwatch();
  requestWakeLock();
  startLive();
  showTagPicker.value = false;
};

const stopStopwatch = async () => {
  await _stopStopwatch();
  releaseWakeLock();
  stopLive();
};

const resetStopwatch = _resetStopwatch;

// ── Tag selection ──
let _currentLoadVersion = 0;
let _unmounted = false;

const selectTag = async (tagId) => {
  if (tag.value?.id === tagId || isSwitching.value) {
    showTagPicker.value = false;
    return;
  }
  isSwitching.value = true;
  showTagPicker.value = false;
  const version = ++_currentLoadVersion;
  try {
    if (stopwatchState.isRunning) await stopStopwatch();
    timerCleanup();
    await loadTag(tagId, { isStillActive: () => version === _currentLoadVersion });
  } finally {
    if (!_unmounted) isSwitching.value = false;
  }
};

// ── Flat tag list ──
const flattenTree = (nodes, depth = 0) => {
  const result = [];
  for (const node of nodes) {
    if (node.type === 'ROOT') {
      if (node.children?.length) result.push(...flattenTree(node.children, depth));
    } else {
      result.push({ ...node, depth });
      if (node.children?.length) result.push(...flattenTree(node.children, depth + 1));
    }
  }
  return result;
};

const flatTagList = computed(() => flattenTree(tagStore.tagTree));

// ── Today total ──
const sumDailyTotals = (nodes) => nodes.reduce((total, node) => {
  const own      = node.type === 'ROOT' ? 0 : (node.dailyTotalTime || 0);
  const children = node.children?.length ? sumDailyTotals(node.children) : 0;
  return total + own + children;
}, 0);

const todayTotalSeconds = computed(() => {
  const serverTagDaily = tag.value
    ? (tagStore.findTagById(tag.value.id)?.dailyTotalTime || 0)
    : 0;
  return sumDailyTotals(tagStore.tagTree) - serverTagDaily + stopwatchState.dailyTotalTimeCal;
});

const formattedTodayTotal = computed(() => formatTime(todayTotalSeconds.value));

// ── Sessions navigation ──
const goToRecords = async () => {
  if (!tag.value) return;
  const pending = getPendingStop?.();
  if (pending) await pending;
  router.push(`/records/${tag.value.id}`);
};

// ── Push notification ──
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

// ── Auto-select running / persisted tag on load ──
const findRunningTagInTree = (nodes) => {
  for (const node of nodes) {
    if (node.state === true && node.latestStartTimeMs) return node;
    if (node.children?.length) {
      const found = findRunningTagInTree(node.children);
      if (found) return found;
    }
  }
  return null;
};

const initTimer = async () => {
  await tagStore.loadTagsFromCache(memberId.value);
  if (!tagStore.hasCachedData) await tagStore.refreshTags(memberId.value);

  // tagId query param (Tags 탭에서 태그 클릭 시 전달)
  const queryTagId = route.query.tagId ? Number(route.query.tagId) : null;
  if (queryTagId) {
    await loadTag(queryTagId);
    return;
  }

  const saved = peekTimerState();
  if (saved?.tagId) { await loadTag(saved.tagId); return; }

  const runningTag = findRunningTagInTree(tagStore.tagTree);
  if (runningTag) await loadTag(runningTag.id);
};

const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    tagStore.refreshTags(memberId.value);
    if (stopwatchState.isRunning) requestWakeLock();
  }
};

const handleOnline = async () => {
  const retryPromise = tagStore.getRetryPromise?.();
  if (retryPromise) await retryPromise;
  if (!_unmounted) initTimer();
};

onMounted(async () => {
  try {
    await initTimer();
  } catch (e) {
    console.error('타이머 초기화 실패:', e);
  }
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('online', handleOnline);
  const sub = await getCurrentSubscription();
  isPushSubscribed.value = !!sub;
});

onBeforeUnmount(() => {
  _unmounted = true;
  timerCleanup();
  releaseWakeLock();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('online', handleOnline);
  stopLive();
});

watch(() => stopwatchState.isRunning, (running) => {
  if (running) startLive(); else stopLive();
}, { immediate: true });

// tagId query param 변경 감지 (같은 라우트에서 다른 태그 선택 시)
watch(() => route.query.tagId, (newId) => {
  if (newId && Number(newId) !== tag.value?.id) selectTag(Number(newId));
});
</script>

<style scoped>
.today-page { position: relative; }

.running-line {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: var(--running);
  box-shadow: 0 0 20px var(--running);
  animation: scan 3s ease infinite;
  z-index: 300;
}

@keyframes scan {
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1; }
}

/* ── Offline banner ── */
.offline-banner {
  background: var(--text-2);
  color: var(--bg);
  text-align: center;
  padding: 6px 16px;
  font-size: 0.75rem;
  opacity: 0.85;
}

/* ── Topbar ── */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.topbar-date {
  font-size: 11px;
  color: var(--text-3);
  letter-spacing: 0.08em;
}

/* ── Tag selector ── */
.tag-selector-section {
  padding: 36px 0 0;
  position: relative;
}

.section-eyebrow {
  font-size: 10px;
  color: var(--text-3);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin-bottom: 10px;
}

.tag-selector-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 14px;
  width: 100%;
  color: var(--text-2);
  font-size: 14px;
  transition: border-color var(--t), color var(--t);
  text-align: left;
}

.tag-selector-btn:hover { border-color: var(--text-3); color: var(--text); }

.selector-name { flex: 1; font-family: var(--font-sans); }

.selector-chevron {
  color: var(--text-3);
  transition: transform var(--t);
  flex-shrink: 0;
}
.selector-chevron.open { transform: rotate(180deg); }

/* ── Tag picker dropdown ── */
.tag-picker {
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  z-index: 100;
  box-shadow: 0 8px 24px rgba(0,0,0,0.18);
}

.tag-picker-scroll {
  max-height: 240px;
  overflow-y: auto;
  padding: 6px 0;
}

.tag-picker-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 9px 14px;
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  text-align: left;
  gap: 8px;
  transition: background var(--t), color var(--t);
}

.tag-picker-item:hover { background: rgba(255,255,255,0.03); color: var(--text); }
.tag-picker-item.selected { color: var(--accent); background: var(--accent-dim); }

.picker-name { flex: 1; }
.picker-daily { font-size: 11px; color: var(--text-3); }

/* ── Timer ── */
.timer-section { padding: 32px 0 8px; }
.timer-empty   { opacity: 0.4; }

.timer-wrap {
  display: flex;
  align-items: baseline;
  gap: 16px;
}

.timer-display {
  font-family: var(--font-mono);
  font-size: clamp(48px, 9vw, 80px);
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

.timer-placeholder {
  font-size: clamp(32px, 6vw, 52px);
  letter-spacing: 0.05em;
}

.timer-unit {
  font-size: 11px;
  color: var(--text-3);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  align-self: flex-end;
  padding-bottom: 8px;
}

.empty-hint {
  font-size: 12px;
  color: var(--text-3);
  letter-spacing: 0.04em;
  margin-top: 14px;
}

/* ── Controls ── */
.controls-section {
  display: flex;
  gap: 10px;
  padding: 24px 0;
}

.ctrl-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 20px;
  height: 38px;
  font-size: 12px;
  letter-spacing: 0.07em;
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text-2);
  border: 1px solid var(--border);
  transition: all var(--t);
}

.ctrl-btn:hover:not(:disabled) { border-color: var(--text-3); color: var(--text); }
.ctrl-btn:active:not(:disabled) { transform: scale(0.97); }
.ctrl-btn:disabled { opacity: 0.25; cursor: not-allowed; }

.ctrl-start.active { background: var(--accent-dim); border-color: rgba(201,169,110,0.25); color: var(--accent); }
.ctrl-stop.active  { background: var(--running-dim); border-color: rgba(111,207,151,0.2);  color: var(--running); }

/* ── Totals row ── */
.totals-section { padding: 0 0 24px; border-bottom: 1px solid var(--border-subtle); }

.totals-row {
  display: flex;
  align-items: stretch;
}

.total-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 16px 0;
}

.total-sep {
  width: 1px;
  background: var(--border-subtle);
  margin: 12px 20px;
  flex-shrink: 0;
}

.total-label {
  font-size: 10px;
  color: var(--text-3);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.total-val {
  font-size: 20px;
  color: var(--text-2);
  letter-spacing: -0.01em;
}

/* ── Stats grid ── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 20px 0;
}

.stat-cell {
  padding: 14px 0;
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
  font-size: 14px;
  color: var(--text-2);
}

/* ── Actions row ── */
.actions-section { padding-bottom: 4px; }

.divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 8px 0 20px;
}

.actions-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.sessions-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  padding: 0;
  transition: color var(--t);
}

.sessions-btn:hover { color: var(--accent); }
.sessions-btn:hover svg path { stroke: var(--accent); }

.notify-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 14px;
  height: 30px;
  font-size: 11px;
  letter-spacing: 0.07em;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-3);
  border: 1px solid var(--border-subtle);
  transition: all var(--t);
}

.notify-btn:hover { color: var(--text-2); border-color: var(--border); }

.notify-btn.subscribed {
  color: var(--accent);
  border-color: rgba(201,169,110,0.2);
  background: var(--accent-dim);
}

/* ── Breakdown ── */
.breakdown-section { padding: 28px 0 60px; }

.breakdown-list { list-style: none; margin: 0; padding: 0; }

.breakdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: color var(--t);
  color: var(--text-2);
  font-size: 13px;
}

.breakdown-item:last-child { border-bottom: none; }
.breakdown-item:hover { color: var(--text); }
.breakdown-item--active { color: var(--accent); }

.breakdown-name { flex: 1; }

.breakdown-time { font-size: 12px; color: var(--text-3); }
.breakdown-item--active .breakdown-time { color: var(--accent); opacity: 0.7; }

/* ── Dots ── */
.selector-dot, .picker-dot, .breakdown-dot {
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.running { background: var(--running); box-shadow: 0 0 6px var(--running); animation: pulse-dot 1.2s ease infinite; }
.stopped { background: var(--border); }

@keyframes pulse-dot {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.mono { font-family: var(--font-mono); }

/* ── Responsive ── */
@media (max-width: 480px) {
  .controls-section { flex-wrap: wrap; }
  .ctrl-btn { flex: 1 1 100%; justify-content: center; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .stat-cell:nth-child(n)     { border-bottom: 1px solid var(--border-subtle); }
  .stat-cell:last-child       { border-bottom: none; }
  .total-sep { margin: 12px 12px; }
  .totals-row { overflow-x: auto; }
}
</style>
