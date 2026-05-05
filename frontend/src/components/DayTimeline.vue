<template>
  <section class="timeline-section">
    <div class="timeline-header">
      <span class="timeline-eyebrow mono">timeline</span>
    </div>

    <div class="timeline-legend">
      <span v-for="(tag, i) in uniqueTags" :key="tag.tagId" class="legend-item">
        <span class="legend-dot" :style="{ background: tagColor(i) }"></span>
        <span class="legend-name">{{ tag.tagName }}</span>
      </span>
    </div>

    <div class="timeline-track-wrap" ref="trackEl" :style="{ height: trackHeight }">
      <div
        v-for="h in 25"
        :key="h"
        class="tick"
        :class="{ 'tick--major': (h - 1) % 6 === 0 }"
        :style="{ left: ((h - 1) / 24 * 100) + '%' }"
      >
        <span v-if="(h - 1) % 6 === 0" class="tick-label mono">
          {{ tickLabel(h - 1) }}
        </span>
      </div>

      <div
        v-for="(session, idx) in positionedSessions"
        :key="idx"
        class="session-bar"
        :style="barStyleWithPosition(session)"
        @mouseenter="showTooltip($event, session)"
        @mouseleave="tooltip = null"
        @click.stop="handleBarClick($event, session)"
      ></div>

      <div
        v-if="tooltip"
        class="timeline-tooltip"
        :style="tooltipStyle"
        @click.stop
      >
        <span class="tt-tag">{{ tooltip.session.tagName }}</span>
        <span class="tt-time mono">{{ fmtTime(tooltip.session.startTime) }} – {{ fmtTime(tooltip.session.endTime) }}</span>
        <span class="tt-dur mono">{{ formatSeconds(tooltip.session.durationSeconds) }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { DateTime } from 'luxon';
import { formatSeconds } from '@/utils/dateRange.js';

const props = defineProps({
  sessions: { type: Array, required: true },
  date: { type: Object, required: true },
});

const RANGE_START_HOUR = 5;
const PALETTE = ['#6fcf97', '#5b9cf6', '#e08a5a', '#a78bfa', '#f472b6', '#34d3cf', '#facc15', '#c9a96e'];

const trackEl = ref(null);
const tooltip = ref(null);

const rangeStart = computed(() =>
  props.date.set({ hour: RANGE_START_HOUR, minute: 0, second: 0, millisecond: 0 })
);
const rangeEnd = computed(() => rangeStart.value.plus({ hours: 24 }));

const visibleSessions = computed(() =>
  props.sessions.filter(s => {
    const t = DateTime.fromISO(s.startTime);
    return t >= rangeStart.value && t < rangeEnd.value;
  })
);

// Lane assignment for overlapping sessions
const positionedSessions = computed(() => {
  const sorted = [...visibleSessions.value].sort((a, b) =>
    DateTime.fromISO(a.startTime).toMillis() - DateTime.fromISO(b.startTime).toMillis()
  );

  const laneEnds = []; // ISO string of endTime per lane

  return sorted.map(session => {
    const start = DateTime.fromISO(session.startTime);
    const end = DateTime.fromISO(session.endTime);

    let lane = laneEnds.findIndex(laneEnd => start >= DateTime.fromISO(laneEnd));
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = end.toISO();

    return { ...session, lane };
  });
});

const laneCount = computed(() => {
  const lanes = positionedSessions.value.map(s => s.lane);
  return lanes.length === 0 ? 1 : Math.max(...lanes) + 1;
});

const trackHeight = computed(() => (laneCount.value * 26 + 16) + 'px');

const uniqueTags = computed(() => {
  const seen = new Set();
  const tags = [];
  for (const s of props.sessions) {
    if (!seen.has(s.tagId)) {
      seen.add(s.tagId);
      tags.push({ tagId: s.tagId, tagName: s.tagName, tagIndex: s.tagIndex });
    }
  }
  return tags;
});

function tagColor(tagIndex) {
  return PALETTE[tagIndex % PALETTE.length];
}

function barStyleWithPosition(session) {
  const start = DateTime.fromISO(session.startTime);
  const end = DateTime.fromISO(session.endTime);
  const clampedEnd = end > rangeEnd.value ? rangeEnd.value : end;

  const startSec = start.diff(rangeStart.value, 'seconds').seconds;
  const durSec = clampedEnd.diff(start, 'seconds').seconds;

  const color = tagColor(session.tagIndex);
  const top = 4 + session.lane * 26;

  return {
    left: (startSec / 86400 * 100) + '%',
    width: Math.max(0.23, durSec / 86400 * 100) + '%',
    top: top + 'px',
    background: color,
  };
}

function tickLabel(h) {
  return rangeStart.value.plus({ hours: h }).toFormat('HH');
}

const tooltipStyle = computed(() => {
  if (!tooltip.value || !trackEl.value) return {};
  const trackWidth = trackEl.value.offsetWidth ?? 680;
  const x = tooltip.value.x;
  const flipLeft = x > trackWidth * 0.7;
  return {
    position: 'absolute',
    bottom: '100%',
    marginBottom: '6px',
    left: flipLeft ? 'auto' : x + 'px',
    right: flipLeft ? (trackWidth - x) + 'px' : 'auto',
    transform: flipLeft ? 'translateX(50%)' : 'translateX(-50%)',
  };
});

function showTooltip(event, session) {
  if (!trackEl.value) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const trackRect = trackEl.value.getBoundingClientRect();
  tooltip.value = {
    session,
    x: rect.left + rect.width / 2 - trackRect.left,
    y: rect.top - trackRect.top,
  };
}

function handleBarClick(event, session) {
  if (!trackEl.value) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const trackRect = trackEl.value.getBoundingClientRect();
  if (tooltip.value?.session === session) {
    tooltip.value = null;
  } else {
    tooltip.value = {
      session,
      x: rect.left + rect.width / 2 - trackRect.left,
      y: rect.top - trackRect.top,
    };
  }
}

function outsideClickHandler() {
  tooltip.value = null;
}

onMounted(() => {
  document.addEventListener('click', outsideClickHandler);
});

onUnmounted(() => {
  document.removeEventListener('click', outsideClickHandler);
});

function fmtTime(iso) {
  return DateTime.fromISO(iso).toFormat('HH:mm');
}
</script>

<style scoped>
.timeline-section {
  padding: 20px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.timeline-header {
  margin-bottom: 10px;
}

.timeline-eyebrow {
  font-size: 10px;
  color: var(--text-3);
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.timeline-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-bottom: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-name {
  font-size: 11px;
  color: var(--text-2);
  white-space: nowrap;
}

.timeline-track-wrap {
  position: relative;
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  overflow: visible;
}

.tick {
  position: absolute;
  top: 0;
  width: 1px;
  height: 6px;
  background: var(--border-subtle);
  transform: translateX(-50%);
  z-index: 1;
}

.tick--major {
  height: 10px;
  background: var(--border);
}

.tick-label {
  position: absolute;
  top: 12px;
  font-size: 9px;
  color: var(--text-3);
  transform: translateX(-50%);
  user-select: none;
  white-space: nowrap;
}

.session-bar {
  position: absolute;
  height: 20px;
  border-radius: 2px;
  min-width: 2px;
  cursor: pointer;
  opacity: 0.82;
  transition: opacity var(--t), transform var(--t);
  z-index: 2;
}

.session-bar:hover {
  opacity: 1;
  transform: scaleY(1.12);
  z-index: 10;
}

.timeline-tooltip {
  z-index: 20;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.tt-tag {
  font-size: 12px;
  color: var(--text);
}

.tt-time,
.tt-dur {
  font-size: 11px;
  color: var(--text-2);
}

.mono {
  font-family: var(--font-mono);
}

@media (max-width: 768px) {
  .session-bar {
    height: 16px;
  }
}

@media (max-width: 480px) {
  .session-bar {
    height: 14px;
  }

  .tick-label {
    font-size: 8px;
  }
}
</style>
