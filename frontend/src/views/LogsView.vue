<template>
  <div class="page">
    <div class="topbar">
      <router-link to="/" class="topbar-brand">timemgr</router-link>
      <div class="topbar-actions">
        <router-link :to="backTo" class="topbar-back">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M10.5 6.5h-8M6 3L2.5 6.5 6 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Tags
        </router-link>
      </div>
    </div>

    <header class="log-header">
      <div>
        <p class="log-eyebrow mono">summary</p>
        <h1 class="log-title">Log</h1>
      </div>
    </header>

    <!-- Tabs -->
    <div class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === tab.key }"
        @click="switchTab(tab.key)"
      >{{ tab.label }}</button>
    </div>

    <!-- Date Navigator -->
    <div class="date-nav">
      <button class="nav-arrow" @click="shiftPeriod('prev')" title="이전">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 11L5 7l4-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <div class="date-display">
        <span class="date-label mono">{{ rangeLabel }}</span>
        <input
          v-if="activeTab === 'daily'"
          type="date"
          class="date-input"
          :value="dateInputValue"
          @change="onDateChange"
          title="날짜 선택"
        />
        <input
          v-else-if="activeTab === 'weekly'"
          type="week"
          class="date-input"
          :value="weekInputValue"
          @change="onWeekChange"
          title="주 선택"
        />
        <input
          v-else
          type="month"
          class="date-input"
          :value="monthInputValue"
          @change="onMonthChange"
          title="월 선택"
        />
      </div>

      <button class="nav-arrow" @click="shiftPeriod('next')" title="다음" :disabled="isToday">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="state-row">
      <span class="dot stopped"></span>
      <span class="mono">Loading…</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="state-row error-state">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.1"/>
        <path d="M7 4v4M7 9.5v.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Empty -->
    <div v-else-if="!summary || summary.tagSummaries.length === 0" class="state-row">
      <span class="dot stopped"></span>
      <span class="mono">이 기간에 기록이 없습니다.</span>
    </div>

    <!-- Summary Content -->
    <div v-else class="summary-content">
      <!-- Total -->
      <div class="total-row">
        <span class="total-label mono">Total</span>
        <span class="total-value">{{ formatSeconds(summary.totalSeconds) }}</span>
      </div>

      <!-- Bar Chart -->
      <div class="chart-section">
        <div
          v-for="tag in summary.tagSummaries"
          :key="tag.tagId"
          class="chart-row"
        >
          <div class="chart-tag-name">
            <span class="tag-name-text">{{ tag.tagName }}</span>
            <span v-if="tag.parentTagName" class="tag-parent mono">{{ tag.parentTagName }}</span>
          </div>
          <div class="chart-bar-wrap">
            <div
              class="chart-bar"
              :style="{ width: barWidth(tag.totalSeconds) + '%' }"
            ></div>
          </div>
          <span class="chart-time mono">{{ formatSeconds(tag.totalSeconds) }}</span>
        </div>
      </div>

      <!-- Day Timeline -->
      <DayTimeline
        v-if="activeTab === 'daily'"
        :sessions="timelineSessions"
        :date="timelineDate"
      />

      <!-- Session List per Tag -->
      <div class="sessions-section">
        <div
          v-for="tag in summary.tagSummaries"
          :key="'sess-' + tag.tagId"
          class="tag-sessions"
        >
          <button class="tag-sessions-header" @click="toggleTag(tag.tagId)">
            <svg
              class="toggle-icon"
              :class="{ 'toggle-icon--open': openTags.has(tag.tagId) }"
              width="12" height="12" viewBox="0 0 12 12" fill="none"
            >
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="tag-sessions-name">{{ tag.tagName }}</span>
            <span class="tag-sessions-count mono">{{ tag.sessionCount }}세션 · {{ formatSeconds(tag.totalSeconds) }}</span>
          </button>

          <div v-if="openTags.has(tag.tagId)" class="session-list">
            <div
              v-for="(session, idx) in tag.sessions"
              :key="idx"
              class="session-row"
            >
              <span class="session-time mono">{{ formatDateTime(session.startTime) }}</span>
              <span class="session-sep mono">–</span>
              <span class="session-time mono">{{ formatTimeOnly(session.endTime) }}</span>
              <span class="session-dur mono">{{ formatSeconds(session.durationSeconds) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { DateTime } from 'luxon';
import apiClient from '@/utils/apiClient';
import { getDailyRange, getWeeklyRange, getMonthlyRange, formatRangeLabel, shiftDate, formatSeconds } from '@/utils/dateRange.js';
import DayTimeline from '@/components/DayTimeline.vue';

const tabs = [
  { key: 'daily', label: '일간' },
  { key: 'weekly', label: '주간' },
  { key: 'monthly', label: '월간' },
];

const activeTab = ref('daily');
const selectedDate = ref(new Date());
const summary = ref(null);
const loading = ref(false);
const error = ref(null);
const openTags = ref(new Set());

const auth = JSON.parse(localStorage.getItem('auth') || '{}');
const memberId = auth.memberId;
const backTo = memberId ? `/members/${memberId}/tags` : '/';

const rangeLabel = computed(() => formatRangeLabel(activeTab.value, selectedDate.value));

const dateInputValue = computed(() => DateTime.fromJSDate(selectedDate.value).toISODate());
const weekInputValue = computed(() => {
  const d = DateTime.fromJSDate(selectedDate.value);
  const week = d.weekNumber.toString().padStart(2, '0');
  return `${d.weekYear}-W${week}`;
});
const monthInputValue = computed(() => DateTime.fromJSDate(selectedDate.value).toFormat('yyyy-MM'));

const isToday = computed(() => {
  const today = DateTime.now().startOf('day');
  const sel = DateTime.fromJSDate(selectedDate.value).startOf('day');
  return sel >= today;
});

function getRange() {
  if (activeTab.value === 'daily') return getDailyRange(selectedDate.value);
  if (activeTab.value === 'weekly') return getWeeklyRange(selectedDate.value);
  return getMonthlyRange(selectedDate.value);
}

async function fetchSummary() {
  loading.value = true;
  error.value = null;
  summary.value = null;
  openTags.value = new Set();
  try {
    const { start, end } = getRange();
    const res = await apiClient.get('/api/v1/records/summary', { params: { startDate: start, endDate: end } });
    summary.value = res.data;
  } catch {
    error.value = '데이터를 불러오지 못했습니다.';
  } finally {
    loading.value = false;
  }
}

function switchTab(tab) {
  activeTab.value = tab;
}

function shiftPeriod(direction) {
  selectedDate.value = shiftDate(activeTab.value, selectedDate.value, direction);
}

function onDateChange(e) {
  if (e.target.value) selectedDate.value = new Date(e.target.value + 'T12:00:00');
}

function onWeekChange(e) {
  if (e.target.value) {
    const [year, week] = e.target.value.split('-W');
    selectedDate.value = DateTime.fromObject({ weekYear: parseInt(year), weekNumber: parseInt(week) }).toJSDate();
  }
}

function onMonthChange(e) {
  if (e.target.value) {
    const [year, month] = e.target.value.split('-');
    selectedDate.value = new Date(parseInt(year), parseInt(month) - 1, 1);
  }
}

function toggleTag(tagId) {
  const next = new Set(openTags.value);
  if (next.has(tagId)) next.delete(tagId);
  else next.add(tagId);
  openTags.value = next;
}

function barWidth(seconds) {
  if (!summary.value || summary.value.totalSeconds === 0) return 0;
  return Math.round((seconds / summary.value.totalSeconds) * 100);
}

function formatDateTime(iso) {
  return DateTime.fromISO(iso).toFormat('MM-dd HH:mm');
}

function formatTimeOnly(iso) {
  return DateTime.fromISO(iso).toFormat('HH:mm');
}

const timelineSessions = computed(() => {
  if (!summary.value || activeTab.value !== 'daily') return [];
  return summary.value.tagSummaries.flatMap((tag, tagIndex) =>
    tag.sessions.map(s => ({
      tagId: tag.tagId,
      tagName: tag.tagName,
      tagIndex,
      startTime: s.startTime,
      endTime: s.endTime,
      durationSeconds: s.durationSeconds,
    }))
  );
});

const timelineDate = computed(() =>
  DateTime.fromJSDate(selectedDate.value).startOf('day')
);

watch([activeTab, selectedDate], fetchSummary);
onMounted(fetchSummary);
</script>

<style scoped>
.topbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.log-header {
  padding: 52px 0 28px;
  border-bottom: 1px solid var(--border-subtle);
}

.log-eyebrow {
  font-size: 10px;
  color: var(--text-2);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin-bottom: 10px;
}

.log-title {
  font-family: var(--font-serif);
  font-size: 34px;
  color: var(--text);
  font-weight: 400;
}

/* Tabs */
.tab-bar {
  display: flex;
  gap: 2px;
  padding: 16px 0 0;
  border-bottom: 1px solid var(--border-subtle);
}

.tab-btn {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--text-3);
  background: transparent;
  padding: 8px 14px;
  border-radius: var(--radius) var(--radius) 0 0;
  border: 1px solid transparent;
  border-bottom: none;
  transition: color var(--t), background var(--t), border-color var(--t);
  text-transform: uppercase;
}

.tab-btn:hover { color: var(--text-2); }

.tab-btn--active {
  color: var(--text);
  background: var(--surface);
  border-color: var(--border-subtle);
  border-bottom-color: var(--surface);
  margin-bottom: -1px;
}

/* Date Navigator */
.date-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.nav-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  color: var(--text-2);
  border-radius: var(--radius);
  transition: color var(--t), background var(--t);
}

.nav-arrow:hover:not(:disabled) {
  color: var(--text);
  background: var(--surface);
}

.nav-arrow:disabled { opacity: 0.25; cursor: default; }

.date-display {
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
}

.date-label {
  font-size: 13px;
  color: var(--text);
}

.date-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
}

/* States */
.state-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 56px 0;
  color: var(--text-2);
  font-size: 13px;
}
.error-state { color: var(--danger); }
.dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text-3); }

/* Summary */
.summary-content { padding-top: 0; }

.total-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 20px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.total-label {
  font-size: 10px;
  color: var(--text-3);
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.total-value {
  font-family: var(--font-serif);
  font-size: 28px;
  color: var(--text);
}

/* Bar Chart */
.chart-section {
  padding: 20px 0;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chart-row {
  display: grid;
  grid-template-columns: 140px 1fr 80px;
  gap: 12px;
  align-items: center;
}

.chart-tag-name {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.tag-name-text {
  font-size: 13px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag-parent {
  font-size: 10px;
  color: var(--text-3);
  letter-spacing: 0.06em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chart-bar-wrap {
  background: var(--surface-2);
  border-radius: var(--radius);
  height: 4px;
  overflow: hidden;
}

.chart-bar {
  height: 100%;
  background: var(--accent);
  border-radius: var(--radius);
  transition: width 400ms ease;
}

.chart-time {
  font-size: 12px;
  color: var(--text-2);
  text-align: right;
}

/* Sessions */
.sessions-section {
  padding-top: 8px;
}

.tag-sessions {
  border-bottom: 1px solid var(--border-subtle);
}

.tag-sessions-header {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  background: transparent;
  color: var(--text);
  padding: 14px 0;
  transition: color var(--t);
  text-align: left;
}

.tag-sessions-header:hover { color: var(--accent); }

.toggle-icon {
  flex-shrink: 0;
  color: var(--text-3);
  transition: transform var(--t);
}

.toggle-icon--open { transform: rotate(0deg); }
.toggle-icon:not(.toggle-icon--open) { transform: rotate(-90deg); }

.tag-sessions-name {
  font-size: 13px;
  flex: 1;
}

.tag-sessions-count {
  font-size: 11px;
  color: var(--text-3);
  letter-spacing: 0.06em;
  flex-shrink: 0;
}

.session-list {
  padding-bottom: 8px;
}

.session-row {
  display: grid;
  grid-template-columns: auto auto auto 1fr;
  gap: 8px;
  align-items: center;
  padding: 8px 0 8px 22px;
  border-top: 1px solid var(--border-subtle);
}

.session-time {
  font-size: 12px;
  color: var(--text-2);
}

.session-sep {
  font-size: 12px;
  color: var(--text-3);
}

.session-dur {
  font-size: 12px;
  color: var(--text-3);
  text-align: right;
}

.mono { font-family: var(--font-mono); }

@media (max-width: 768px) {
  .log-header { padding: 36px 0 24px; }
  .log-title { font-size: 28px; }

  .chart-row {
    grid-template-columns: 100px 1fr 70px;
    gap: 8px;
  }

  .session-row {
    padding-left: 12px;
  }
}

@media (max-width: 480px) {
  .log-title { font-size: 24px; }

  .chart-row {
    grid-template-columns: 80px 1fr 60px;
    gap: 6px;
  }

  .total-value { font-size: 22px; }
}
</style>
