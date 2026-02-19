<template>
  <li class="tag-item">
    <div
      class="tag-row"
      :style="{ paddingLeft: `${40 + depth * 22}px` }"
      @click="navigateToDetail"
    >
      <div class="tag-row-inner">
        <span class="tag-indicator">
          <svg v-if="tagChildren.length > 0" width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M2 1.5L6 4.5 2 7.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span v-else class="tag-bullet-dot"></span>
        </span>
        <span class="tag-name">{{ tagName }}</span>
      </div>

      <div class="tag-row-meta">
        <span class="tag-sub-count mono" v-if="tagChildren.length > 0">
          {{ tagChildren.length }} sub
        </span>
        <svg class="tag-arrow" width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M4.5 2.5l4 4-4 4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>

    <ul v-if="tagChildren.length > 0">
      <TagItem
        v-for="child in tagChildren"
        :key="child.id"
        :tag="child"
        :depth="depth + 1"
        @navigate="$emit('navigate', $event)"
      />
    </ul>
  </li>
</template>

<script setup>
import { computed, defineProps, defineEmits } from 'vue';

const props = defineProps({
  tag:   { type: Object, required: true },
  depth: { type: Number, default: 0 },
});

const emit = defineEmits(['navigate']);

const tagName     = computed(() => props.tag?.name ?? '—');
const tagChildren = computed(() => props.tag?.children ?? []);

const navigateToDetail = () => emit('navigate', props.tag.id);
</script>

<style scoped>
.tag-item { border-bottom: 1px solid var(--border-subtle); }

.tag-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 15px;
  padding-bottom: 15px;
  padding-right: 40px;
  cursor: pointer;
  transition: background var(--t);
  margin: 0 -40px;
}

.tag-row:hover { background: var(--surface); }
.tag-row:hover .tag-arrow { color: var(--text); transform: translateX(2px); }
.tag-row:hover .tag-name  { color: var(--text); }

.tag-row-inner {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tag-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  color: var(--text-3);
  flex-shrink: 0;
}

.tag-bullet-dot {
  width: 3px;
  height: 3px;
  background: var(--text-3);
  border-radius: 50%;
  display: block;
}

.tag-name {
  font-size: 14px;
  color: var(--text-2);
  transition: color var(--t);
  font-weight: 400;
}

.tag-row-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tag-sub-count {
  font-size: 10px;
  color: var(--text-3);
}

.tag-arrow {
  color: var(--text-3);
  transition: all var(--t);
}

.mono { font-family: var(--font-mono); }
</style>
