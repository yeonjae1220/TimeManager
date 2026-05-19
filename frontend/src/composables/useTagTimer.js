import { ref, reactive, computed, watchEffect } from 'vue';
import apiClient from '@/utils/apiClient';
import { saveTimerState, loadTimerState, clearTimerState } from '@/utils/timerPersistence';
import { useTagStore } from '@/stores/tagStore';

export function useTagTimer() {
  const tagStore = useTagStore();
  const tag = ref(null);
  let _pendingStop = null;

  const nowMs = ref(Date.now());

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

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00:00';
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(Math.floor(seconds % 60)).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const formattedStartTime = ref('—');
  const formattedEndTime = ref('—');

  watchEffect(() => {
    if (!stopwatchState.latestStartTime) return;
    const date = new Date(stopwatchState.latestStartTime);
    formattedStartTime.value = date.getFullYear() === 1970 ? '—' : date.toLocaleTimeString();
  });

  watchEffect(() => {
    if (!stopwatchState.latestEndTime) return;
    const date = new Date(stopwatchState.latestEndTime);
    formattedEndTime.value = date.getFullYear() === 1970 ? '—' : date.toLocaleTimeString();
  });

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
    if (!stopwatchState.isRunning || stopwatchState.latestStartTime <= 0) return;
    const currentTime = Date.now();
    nowMs.value = currentTime;
    const deltaTime = Math.floor((currentTime - stopwatchState.latestStartTime) / 1000);
    if (deltaTime < 0) return;
    stopwatchState.elapsedTimeCal    = deltaTime + stopwatchState.elapsedTime;
    stopwatchState.dailyTotalTimeCal = stopwatchState.dailyTotalTime + deltaTime;
    stopwatchState.tagTotalTimeCal   = stopwatchState.tagTotalTime + deltaTime;
    stopwatchState.totalTimeCal      = stopwatchState.totalTime + deltaTime;
    stopwatchState.rAF_ID = requestAnimationFrame(updateTimer);
  };

  const hydrateStopwatchState = () => {
    stopwatchState.elapsedTimeCal    = stopwatchState.elapsedTime;
    stopwatchState.dailyTotalTimeCal = stopwatchState.dailyTotalTime;
    stopwatchState.tagTotalTimeCal   = stopwatchState.tagTotalTime;
    stopwatchState.totalTimeCal      = stopwatchState.totalTime;
    cancelAnimationFrame(stopwatchState.rAF_ID);
    if (stopwatchState.isRunning && stopwatchState.latestStartTime > 0) {
      updateTimer();
    }
  };

  const applyTagData = (source, options = {}) => {
    const isTreeNode = Array.isArray(source.children);
    tag.value = isTreeNode
      ? { ...source, childrenList: source.children.map(c => c.id) }
      : source;

    const saved = options.saved;
    if (saved && saved.savedAt > (source.latestStartTimeMs || 0) && saved.savedAt > (source.latestStopTimeMs || 0)) {
      const isSavedToday = saved.savedDate === new Date().toLocaleDateString('sv');
      stopwatchState.isRunning       = saved.isRunning;
      stopwatchState.latestStartTime = saved.latestStartTime;
      stopwatchState.latestEndTime   = saved.latestEndTime;
      stopwatchState.elapsedTime     = saved.elapsedTime;
      stopwatchState.dailyTotalTime  = isSavedToday ? saved.dailyTotalTime : (source.dailyTotalTime || 0);
      stopwatchState.dailyGoalTime   = saved.dailyGoalTime || source.dailyGoalTime || 0;
      stopwatchState.tagTotalTime    = saved.tagTotalTime;
      stopwatchState.totalTime       = saved.totalTime;
    } else {
      stopwatchState.isRunning        = source.state || false;
      stopwatchState.latestStartTime  = source.latestStartTimeMs || 0;
      stopwatchState.latestEndTime    = source.latestStopTimeMs || 0;
      stopwatchState.elapsedTime      = source.elapsedTime || 0;
      stopwatchState.dailyTotalTime   = source.dailyTotalTime || 0;
      stopwatchState.dailyGoalTime    = source.dailyGoalTime || 0;
      stopwatchState.tagTotalTime     = source.tagTotalTime || 0;
      stopwatchState.totalTime        = source.totalTime || 0;
      if (!saved || (!source.state && saved.isRunning)) clearTimerState();
    }
    hydrateStopwatchState();
  };

  // isStillActive: optional () => bool — if it returns false after the API call, discard the result
  // ensureStoreLoaded: optional async fn — called before cache lookup (for deep link support)
  const loadTag = async (tagId, { isStillActive = () => true, ensureStoreLoaded } = {}) => {
    const numId = Number(tagId);

    if (ensureStoreLoaded) await ensureStoreLoaded();

    const saved = loadTimerState(numId);
    const cached = tagStore.findTagById(numId);
    if (cached) {
      applyTagData(cached, { saved });
    } else if (saved) {
      tag.value = { id: numId, name: '...', memberId: null };
    }

    try {
      const response = await apiClient.get(`/api/v1/tags/${tagId}`);
      if (!isStillActive()) return;
      const freshSaved = loadTimerState(numId);
      applyTagData(response.data, { saved: freshSaved });
    } catch (error) {
      console.error('태그 데이터 네트워크 조회 실패:', error);
    }
  };

  const startStopwatch = async () => {
    if (stopwatchState.isRunning || !tag.value) return;
    stopwatchState.isRunning       = true;
    stopwatchState.latestStartTime = Date.now();
    updateTimer();
    tagStore.setTagState(tag.value.id, true);
    saveTimerState(tag.value.id, stopwatchState);
    try {
      await apiClient.post(
        `/api/v1/tags/${tag.value.id}/timer/start`,
        { startTime: new Date(stopwatchState.latestStartTime).toISOString() },
        { headers: { 'Content-Type': 'application/json' } }
      );
      tagStore.refreshTags(tag.value.memberId);
    } catch (error) {
      console.warn('스톱워치 시작 요청 큐잉됨 (오프라인):', error.message);
    }
  };

  const stopStopwatch = async () => {
    if (!stopwatchState.isRunning || !tag.value) return;
    stopwatchState.isRunning = false;
    cancelAnimationFrame(stopwatchState.rAF_ID);
    tagStore.setTagState(tag.value.id, false);
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
    const savedTagId = tag.value.id;
    const savedMemberId = tag.value.memberId;
    const savedStart = stopwatchState.latestStartTime;
    const savedEnd = stopwatchState.latestEndTime;
    const savedElapsed = stopwatchState.elapsedTime;
    _pendingStop = (async () => {
      try {
        await apiClient.post(
          `/api/v1/tags/${savedTagId}/timer/stop`,
          {
            elapsedTime: savedElapsed,
            timestamps: {
              startTime: new Date(savedStart).toISOString(),
              endTime:   new Date(savedEnd).toISOString(),
            },
          },
          { headers: { 'Content-Type': 'application/json' } }
        );
        clearTimerState();
        tagStore.refreshTags(savedMemberId);
      } catch (error) {
        console.warn('스톱워치 종료 요청 큐잉됨 (오프라인):', error.message);
      } finally {
        _pendingStop = null;
      }
    })();
    await _pendingStop;
  };

  const resetStopwatch = async () => {
    if (stopwatchState.isRunning || !tag.value) return;
    stopwatchState.elapsedTimeCal = 0;
    stopwatchState.elapsedTime    = 0;
    saveTimerState(tag.value.id, stopwatchState);
    try {
      await apiClient.post(
        `/api/v1/tags/${tag.value.id}/timer/reset`,
        { elapsedTime: stopwatchState.elapsedTime },
        { headers: { 'Content-Type': 'application/json' } }
      );
      clearTimerState();
      tagStore.refreshTags(tag.value.memberId);
    } catch (error) {
      console.warn('스톱워치 리셋 요청 큐잉됨 (오프라인):', error.message);
    }
  };

  const cleanup = () => {
    cancelAnimationFrame(stopwatchState.rAF_ID);
  };

  const getPendingStop = () => _pendingStop;

  return {
    tag,
    stopwatchState,
    nowMs,
    loadTag,
    applyTagData,
    startStopwatch,
    stopStopwatch,
    resetStopwatch,
    cleanup,
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
  };
}
