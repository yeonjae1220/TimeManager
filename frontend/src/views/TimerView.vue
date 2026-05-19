<template>
  <div class="page timer-page" :class="{ 'is-running': stopwatchState.isRunning }">

    <!-- Offline banner -->
    <div v-if="!isOnline" class="offline-banner">
      <span class="mono">오프라인 — 복귀 후 자동 동기화됩니다</span>
    </div>

    <!-- Topbar -->
    <div class="topbar">
      <router-link :to="`/members/${memberId}/tags`" class="topbar-back">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M10.5 6.5h-8M6 3L2.5 6.5 6 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Tags
      </router-link>
    </div>

    <!-- Today total hero -->
    <header class="timer-header">
      <p class="header-eyebrow mono">today</p>
      <div class="header-total-row">
        <span class="header-total mono">{{ formattedTodayTotal }}</span>
        <span class="header-total-label mono">total</span>
      </div>
    </header>

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

    <!-- Timer display -->
    <section class="timer-section" v-if="tag">
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

    <!-- Placeholder when no tag selected -->
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

    <!-- Stats for selected tag -->
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
        <span class="stat-label mono">tag total</span>
        <span class="stat-val mono">{{ formattedTagTotalTime }}</span>
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

    <!-- Today's tag breakdown -->
    <section class="breakdown-section" v-if="flatTagList.length">
      <div class="divider"></div>
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
          <span class="breakdown-time mono">{{ formatTime(t.dailyTotalTime || 0) }}</span>
        </li>
      </ul>
    </section>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useTagStore } from '@/stores/tagStore';
import { useNetworkStatus } from '@/composables/useNetworkStatus';
import { useLiveIndicator } from '@/composables/useLiveIndicator';
import { useTagTimer } from '@/composables/useTagTimer';
import { peekTimerState } from '@/utils/timerPersistence';

const route = useRoute();
const memberId = computed(() => route.params.id);
const tagStore = useTagStore();
const { isOnline } = useNetworkStatus();
const { startLive, stopLive } = useLiveIndicator();

const {
  tag,
  stopwatchState,
  loadTag,
  startStopwatch: _startStopwatch,
  stopStopwatch: _stopStopwatch,
  resetStopwatch: _resetStopwatch,
  cleanup: timerCleanup,
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

const showTagPicker = ref(false);
const nowMs = ref(Date.now());
const persistedTimer = ref(peekTimerState());
let timerTick = null;

// ── Wake Lock ──
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

// ── Controls (wrap to add wake lock + live indicator) ──
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
const isSwitching = ref(false);
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
    await loadTag(tagId, {
      isStillActive: () => version === _currentLoadVersion,
    });
  } finally {
    if (!_unmounted) isSwitching.value = false;
  }
};

// ── Flat tag list (for picker and breakdown) ──
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

// ── Today total (mirrors TagList logic) ──
const sumDailyTotals = (nodes) => nodes.reduce((total, node) => {
  const own = node.type === 'ROOT' ? 0 : (node.dailyTotalTime || 0);
  const children = node.children?.length ? sumDailyTotals(node.children) : 0;
  return total + own + children;
}, 0);

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

const todayKey = () => new Date().toLocaleDateString('sv');

const todayTotalSeconds = computed(() => {
  const treeTotal = sumDailyTotals(tagStore.tagTree);
  const runningTag = findRunningTagInTree(tagStore.tagTree);

  if (persistedTimer.value) {
    const localIsStale = !runningTag || runningTag.id !== persistedTimer.value.tagId;
    if (localIsStale) {
      const target = tagStore.findTagById(persistedTimer.value.tagId);
      const serverDaily = target?.dailyTotalTime || 0;
      const localDaily = persistedTimer.value.dailyTotalTime || 0;
      return treeTotal + Math.max(0, localDaily - serverDaily);
    }
    if (!persistedTimer.value || persistedTimer.value.savedDate !== todayKey()) return treeTotal;
    if (Date.now() - (persistedTimer.value.savedAt || 0) > 25 * 60 * 60 * 1000) return treeTotal;
    const target = tagStore.findTagById(persistedTimer.value.tagId);
    const serverDaily = target?.dailyTotalTime || 0;
    const localDaily = persistedTimer.value.dailyTotalTime || 0;
    const replacementBase = Math.max(0, localDaily - serverDaily);
    if (!persistedTimer.value.isRunning || !persistedTimer.value.latestStartTime) {
      return treeTotal + replacementBase;
    }
    const liveDelta = Math.max(0, Math.floor((nowMs.value - persistedTimer.value.latestStartTime) / 1000));
    return treeTotal + replacementBase + liveDelta;
  }

  if (runningTag) {
    const liveDelta = Math.max(0, Math.floor((nowMs.value - runningTag.latestStartTimeMs) / 1000));
    return treeTotal + liveDelta;
  }

  return treeTotal;
});

const formattedTodayTotal = computed(() => {
  const s = todayTotalSeconds.value;
  if (!Number.isFinite(s) || s < 0) return '00:00:00';
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(Math.floor(s % 60)).padStart(2, '0');
  return `${h}:${m}:${sec}`;
});

// ── Live indicator sync ──
watch(() => stopwatchState.isRunning, (running) => {
  if (running) startLive(); else stopLive();
}, { immediate: true });

// ── Tick for today total ──
const syncTick = () => {
  persistedTimer.value = peekTimerState();
  nowMs.value = Date.now();
};

// ── Auto-select running tag on load ──
const initTimer = async () => {
  await tagStore.loadTagsFromCache(memberId.value);
  if (!tagStore.hasCachedData) {
    await tagStore.refreshTags(memberId.value);
  }

  // If a tag is already running, select it
  const saved = peekTimerState();
  if (saved?.tagId) {
    await loadTag(saved.tagId);
    return;
  }
  const runningTag = findRunningTagInTree(tagStore.tagTree);
  if (runningTag) {
    await loadTag(runningTag.id);
  }
};

const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    syncTick();
    tagStore.refreshTags(memberId.value);
    if (stopwatchState.isRunning) requestWakeLock();
  }
};

onMounted(() => {
  initTimer();
  timerTick = window.setInterval(syncTick, 1000);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('storage', syncTick);
});

onBeforeUnmount(() => {
  _unmounted = true;
  timerCleanup();
  releaseWakeLock();
  if (timerTick) window.clearInterval(timerTick);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('storage', syncTick);
  if (!stopwatchState.isRunning) stopLive();
});
</script>

<style scoped>
/* ── Running tint ── */
.timer-page { position: relative; }

.timer-page.is-running::before {
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

/* ── Offline banner ── */
.offline-banner {
  background: var(--text-2, #888);
  color: var(--bg, #fff);
  text-align: center;
  padding: 6px 16px;
  font-size: 0.75rem;
  opacity: 0.85;
}

/* ── Header ── */
.timer-header {
  padding: 48px 0 32px;
  border-bottom: 1px solid var(--border-subtle);
}

.header-eyebrow {
  font-size: 10px;
  color: var(--text-3);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.header-total-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.header-total {
  font-size: clamp(48px, 9vw, 72px);
  font-weight: 400;
  color: var(--text);
  letter-spacing: -0.02em;
  line-height: 1;
  user-select: none;
}

.header-total-label {
  font-size: 11px;
  color: var(--text-3);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  align-self: flex-end;
  padding-bottom: 8px;
}

/* ── Tag selector ── */
.tag-selector-section {
  padding: 28px 0 0;
  position: relative;
}

.section-eyebrow {
  font-size: 10px;
  color: var(--text-3);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin-bottom: 12px;
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

.tag-selector-btn:hover {
  border-color: var(--text-3);
  color: var(--text);
}

.selector-name {
  flex: 1;
  font-family: var(--font-sans);
}

.selector-chevron {
  color: var(--text-3);
  transition: transform var(--t);
  flex-shrink: 0;
}

.selector-chevron.open { transform: rotate(180deg); }

/* ── Tag picker ── */
.tag-picker {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
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

.tag-picker-item:hover { background: var(--surface-hover, rgba(255,255,255,0.03)); color: var(--text); }

.tag-picker-item.selected {
  color: var(--accent);
  background: var(--accent-dim);
}

.picker-name { flex: 1; }

.picker-daily {
  font-size: 11px;
  color: var(--text-3);
}

/* ── Timer section ── */
.timer-section {
  padding: 32px 0 24px;
  border-bottom: 1px solid var(--border-subtle);
}

.timer-empty { opacity: 0.4; }

.timer-wrap {
  display: flex;
  align-items: baseline;
  gap: 16px;
  margin-bottom: 24px;
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
}

/* Progress bar */
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
  padding: 28px 0;
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

.ctrl-btn:hover:not(:disabled) { border-color: var(--text-3); color: var(--text); }
.ctrl-btn:active:not(:disabled) { transform: scale(0.97); }
.ctrl-btn:disabled { opacity: 0.25; cursor: not-allowed; transform: none; }

.ctrl-start.active {
  background: var(--accent-dim);
  border-color: rgba(201, 169, 110, 0.25);
  color: var(--accent);
}

.ctrl-stop.active {
  background: var(--running-dim);
  border-color: rgba(111, 207, 151, 0.2);
  color: var(--running);
}

/* ── Stats grid ── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
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

/* ── Breakdown ── */
.breakdown-section { padding-bottom: 60px; }

.divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 16px 0 28px;
}

.breakdown-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

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

.breakdown-time {
  font-size: 12px;
  color: var(--text-3);
}

.breakdown-item--active .breakdown-time { color: var(--accent); opacity: 0.7; }

/* ── Dots ── */
.dot, .selector-dot, .picker-dot, .breakdown-dot, .span-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot.running, .selector-dot.running, .picker-dot.running, .breakdown-dot.running {
  background: var(--running);
  box-shadow: 0 0 6px var(--running);
  animation: pulse-dot 1.2s ease infinite;
}

.dot.stopped, .selector-dot.stopped, .picker-dot.stopped, .breakdown-dot.stopped {
  background: var(--border);
}

@keyframes pulse-dot {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.mono { font-family: var(--font-mono); }

/* ── Responsive ── */
@media (max-width: 480px) {
  .controls-section { flex-wrap: wrap; }
  .ctrl-btn { flex: 1 1 100%; justify-content: center; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .stat-cell:nth-child(n) { border-bottom: 1px solid var(--border-subtle); }
  .stat-cell:last-child { border-bottom: none; }
}
</style>
