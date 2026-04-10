<template>
  <li class="tag-item" :data-tag-id="tag.id">
    <!-- Main row -->
    <div
      ref="rowRef"
      class="tag-row"
      :class="{
        'tag-row--drag-over': isDragOver,
        'tag-row--dragging': injDraggedTagId === tag.id,
        'tag-row--live': showLiveIndicator,
      }"
      :draggable="editMode"
      :style="{ paddingLeft: `${40 + depth * 22}px` }"
      @dragstart="onDragStart"
      @dragover.prevent="onDragOver"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
      @dragend="onDragEnd"
    >
      <!-- Left: chevron or bullet -->
      <button
        v-if="hasChildren"
        class="chevron-btn"
        :class="{ 'chevron-btn--open': isExpanded }"
        @click.stop="toggleExpanded"
        tabindex="-1"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <span v-else class="tag-bullet"></span>

      <!-- Tag name -->
      <span class="tag-name" @click.stop="onRowClick">{{ tagName }}</span>

      <!-- Right actions -->
      <div class="tag-row-right">
        <template v-if="editMode">
          <button class="icon-btn" title="Edit" @click.stop="showEditModal = true">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M8.5 2l2.5 2.5-6.5 6.5L2 11.5l.5-2.5L8.5 2z" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="icon-btn icon-btn--danger" title="Discard" @click.stop="discardTag">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 4h9M5 4V2.5h3V4M5.5 6.5v3M7.5 6.5v3M3 4l.75 7h5.5L10 4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <span class="drag-grip" @touchstart.passive="onTouchStart">⠿</span>
        </template>
        <template v-else>
          <span v-if="hasChildren" class="tag-sub-count mono">{{ tagChildren.length }} sub</span>
          <span v-if="showLiveIndicator" class="live-badge">
            <span class="dot running"></span>
            <span class="live-label mono">live</span>
          </span>
          <button class="icon-btn add-btn" title="Add child tag" @click.stop="openAddForm">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </button>
          <svg class="tag-arrow" width="13" height="13" viewBox="0 0 13 13" fill="none" @click.stop="onRowClick">
            <path d="M4.5 2.5l4 4-4 4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </template>
      </div>
    </div>

    <!-- Inline add form -->
    <div
      v-if="showAddForm"
      class="add-form"
      :style="{ paddingLeft: `${40 + (depth + 1) * 22}px` }"
    >
      <input
        ref="addInput"
        v-model="newTagName"
        class="add-input"
        placeholder="Tag name…"
        @keydown.enter="submitAdd"
        @keydown.esc="cancelAdd"
      />
      <button class="add-confirm" @click="submitAdd">Add</button>
      <button class="add-cancel" @click="cancelAdd">✕</button>
    </div>

    <!-- Children (collapsible) -->
    <Transition name="tree-fade">
      <ul v-if="hasChildren && isExpanded">
        <TagItem
          v-for="child in tagChildren"
          :key="child.id"
          :tag="child"
          :depth="depth + 1"
        />
      </ul>
    </Transition>

    <!-- Edit modal -->
    <EditTagModal
      :isOpen="showEditModal"
      :tagData="tag"
      @close="onEditModalClose"
    />
  </li>
</template>

<script setup>
import { ref, computed, inject, nextTick, onUnmounted } from 'vue';
import apiClient from '@/utils/apiClient';
import EditTagModal from '@/Modals/EditTagModal.vue';

const props = defineProps({
  tag:   { type: Object, required: true },
  depth: { type: Number, default: 0 },
});

// ── Inject from TagList ────────────────────────────────────────────
const editMode        = inject('editMode',     ref(false));
const injDraggedTagId = inject('draggedTagId', ref(null));
const injOnNavigate   = inject('onNavigate',   () => {});
const injOnRefresh    = inject('onRefresh',    () => {});
const injOnDragStart  = inject('onDragStart',  () => {});
const injOnDragEnd    = inject('onDragEnd',    () => {});
const injOnDropOn     = inject('onDropOn',     async () => {});

// ── Local state ────────────────────────────────────────────────────
const isExpanded   = ref(true);
const showAddForm  = ref(false);
const showEditModal = ref(false);
const newTagName   = ref('');
const isDragOver   = ref(false);

// Template refs
const addInput = ref(null);
const rowRef   = ref(null);

// ── Computed ───────────────────────────────────────────────────────
const tagName     = computed(() => props.tag?.name ?? '—');
const tagChildren = computed(() => props.tag?.children ?? []);
const hasChildren = computed(() => tagChildren.value.length > 0);

// ── Live indicator logic ──────────────────────────────────────────
const hasRunningDescendant = (children) => {
  for (const child of children) {
    if (child.state === true) return true;
    if (child.children?.length && hasRunningDescendant(child.children)) return true;
  }
  return false;
};

const showLiveIndicator = computed(() => {
  if (props.tag?.state === true) return true;
  if (hasChildren.value && !isExpanded.value && hasRunningDescendant(tagChildren.value)) return true;
  return false;
});

// ── Row actions ────────────────────────────────────────────────────
const onRowClick = () => injOnNavigate(props.tag.id);

const toggleExpanded = () => { isExpanded.value = !isExpanded.value; };

const openAddForm = async () => {
  showAddForm.value = true;
  isExpanded.value  = true;
  await nextTick();
  addInput.value?.focus();
};

const cancelAdd = () => {
  showAddForm.value = false;
  newTagName.value  = '';
};

const submitAdd = async () => {
  if (!newTagName.value.trim()) return;
  try {
    await apiClient.post(`/api/v1/tags`, {
      tagName:     newTagName.value.trim(),
      memberId:    props.tag.memberId,
      parentTagId: props.tag.id,
    });
    cancelAdd();
    injOnRefresh();
  } catch (e) {
    console.error('태그 생성 실패:', e);
  }
};

const discardTag = async () => {
  if (!confirm('이 태그를 삭제하시겠습니까?')) return;
  try {
    const res = await apiClient.get(`/api/v1/tags?memberId=${props.tag.memberId}`);
    const flat = (tags) => tags.flatMap(t => [t, ...(t.children ? flat(t.children) : [])]);
    const discarded = flat(res.data).find(t => t.type === 'DISCARDED');
    if (!discarded) { alert('삭제 태그를 찾을 수 없습니다.'); return; }
    await apiClient.patch(`/api/v1/tags/${props.tag.id}`, { newParentTagId: discarded.id });
    injOnRefresh();
  } catch (e) {
    console.error('태그 삭제 실패:', e);
  }
};

const onEditModalClose = () => {
  showEditModal.value = false;
  injOnRefresh();
};

// ── Desktop Drag & Drop ────────────────────────────────────────────
const onDragStart = (e) => {
  injOnDragStart(props.tag.id);
  e.dataTransfer.setData('text/plain', String(props.tag.id));
  e.dataTransfer.effectAllowed = 'move';
};

const onDragOver = () => {
  if (injDraggedTagId.value === props.tag.id) return;
  isDragOver.value = true;
};

const onDragLeave = () => {
  isDragOver.value = false;
};

const onDrop = (e) => {
  isDragOver.value = false;
  const movedId = Number(e.dataTransfer.getData('text/plain'));
  if (movedId && movedId !== props.tag.id) {
    injOnDropOn(props.tag.id, movedId);
  }
};

const onDragEnd = () => {
  isDragOver.value = false;
  injOnDragEnd();
};

// ── Mobile Touch Drag & Drop ───────────────────────────────────────
let touchTimer    = null;
let touchStartX   = 0;
let touchStartY   = 0;
let touchClone    = null;
let prevTouchTarget = null;

const onTouchStart = (e) => {
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;

  const cancelTimer = () => {
    clearTimeout(touchTimer);
    touchTimer = null;
  };

  const checkMovement = (moveEvent) => {
    const t = moveEvent.touches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.sqrt(dx * dx + dy * dy) > 8) {
      cancelTimer();
      document.removeEventListener('touchmove', checkMovement);
      document.removeEventListener('touchend', onEarlyEnd);
    }
  };

  const onEarlyEnd = () => {
    cancelTimer();
    document.removeEventListener('touchmove', checkMovement);
  };

  touchTimer = setTimeout(() => {
    document.removeEventListener('touchmove', checkMovement);
    document.removeEventListener('touchend', onEarlyEnd);
    beginTouchDrag();
  }, 500);

  document.addEventListener('touchmove', checkMovement, { passive: true });
  document.addEventListener('touchend', onEarlyEnd, { once: true });
};

const beginTouchDrag = () => {
  const rowEl = rowRef.value;
  if (!rowEl) return;

  navigator.vibrate?.([50]);
  injOnDragStart(props.tag.id);

  const rect = rowEl.getBoundingClientRect();
  touchClone = rowEl.cloneNode(true);
  Object.assign(touchClone.style, {
    position:      'fixed',
    left:          `${rect.left}px`,
    top:           `${rect.top}px`,
    width:         `${rect.width}px`,
    opacity:       '0.85',
    pointerEvents: 'none',
    zIndex:        '9999',
    background:    'var(--surface-2)',
    border:        '1px solid var(--accent)',
    borderRadius:  'var(--radius)',
    boxShadow:     '0 8px 32px rgba(0,0,0,0.5)',
  });
  document.body.appendChild(touchClone);

  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd, { once: true });
};

const handleTouchMove = (e) => {
  e.preventDefault();
  if (!touchClone) return;

  const touch = e.touches[0];
  const w = touchClone.offsetWidth;
  touchClone.style.left = `${touch.clientX - w / 2}px`;
  touchClone.style.top  = `${touch.clientY - 20}px`;

  // Find drop target under touch point
  touchClone.style.display = 'none';
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  touchClone.style.display = '';

  if (prevTouchTarget) {
    prevTouchTarget.removeAttribute('data-touch-over');
    prevTouchTarget = null;
  }

  const tagLi = el?.closest('[data-tag-id]');
  if (tagLi) {
    const targetId = Number(tagLi.getAttribute('data-tag-id'));
    if (targetId !== props.tag.id) {
      const targetRow = tagLi.querySelector('.tag-row');
      if (targetRow) {
        targetRow.setAttribute('data-touch-over', 'true');
        prevTouchTarget = targetRow;
      }
    }
  }
};

const handleTouchEnd = (e) => {
  const touch = e.changedTouches[0];

  if (touchClone) touchClone.style.display = 'none';
  const el = document.elementFromPoint(touch.clientX, touch.clientY);

  cleanupTouchDrag();

  const tagLi = el?.closest('[data-tag-id]');
  if (tagLi) {
    const targetId = Number(tagLi.getAttribute('data-tag-id'));
    if (targetId !== props.tag.id) {
      injOnDropOn(targetId, props.tag.id);
    }
  }
  injOnDragEnd();
};

const cleanupTouchDrag = () => {
  if (touchClone) { touchClone.remove(); touchClone = null; }
  if (prevTouchTarget) { prevTouchTarget.removeAttribute('data-touch-over'); prevTouchTarget = null; }
  document.removeEventListener('touchmove', handleTouchMove);
};

onUnmounted(() => {
  clearTimeout(touchTimer);
  cleanupTouchDrag();
});
</script>

<style scoped>
.tag-item { border-bottom: 1px solid var(--border-subtle); }

/* ── Row ──────────────────────────────────────────── */
.tag-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 13px;
  padding-bottom: 13px;
  padding-right: 40px;
  cursor: pointer;
  transition: background var(--t);
  margin: 0 -40px;
  user-select: none;
}

.tag-row:hover { background: var(--surface); }
.tag-row:hover .tag-arrow { color: var(--text); transform: translateX(2px); }
.tag-row:hover .tag-name  { color: var(--text); }

.tag-row--drag-over,
.tag-row[data-touch-over] {
  background: var(--accent-dim) !important;
  border-left: 2px solid var(--accent);
}

.tag-row--dragging { opacity: 0.35; }

.tag-row--live {
  background: var(--running-dim);
  border-left: 2px solid var(--running);
}

.live-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 20px;
  border: 1px solid rgba(111, 207, 151, 0.2);
  background: var(--running-dim);
  flex-shrink: 0;
}

.live-label {
  font-size: 9px;
  color: var(--running);
  letter-spacing: 0.1em;
}

/* ── Chevron ──────────────────────────────────────── */
.chevron-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  background: transparent;
  color: var(--text-3);
  padding: 0;
  border-radius: 3px;
  transition: color var(--t), transform 200ms ease;
  transform: rotate(-90deg);
}
.chevron-btn--open { transform: rotate(0deg); }
.chevron-btn:hover { color: var(--text-2); }

.tag-bullet {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tag-bullet::after {
  content: '';
  width: 3px;
  height: 3px;
  background: var(--text-3);
  border-radius: 50%;
  display: block;
}

/* ── Name ─────────────────────────────────────────── */
.tag-name {
  flex: 1;
  font-size: 14px;
  color: var(--text-2);
  transition: color var(--t);
  font-weight: 400;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Right actions ────────────────────────────────── */
.tag-row-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.tag-sub-count {
  font-size: 10px;
  color: var(--text-3);
  font-family: var(--font-mono);
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: transparent;
  color: var(--text-3);
  border-radius: var(--radius);
  transition: color var(--t), background var(--t);
  flex-shrink: 0;
}
.icon-btn:hover { color: var(--text-2); background: var(--surface-2); }
.icon-btn--danger:hover { color: var(--danger); background: var(--danger-dim); }

.add-btn { color: var(--text-3); }
.add-btn:hover { color: var(--accent); background: var(--accent-dim); }

.drag-grip {
  color: var(--text-3);
  font-size: 14px;
  cursor: grab;
  padding: 0 2px;
  letter-spacing: -1px;
  user-select: none;
  touch-action: none;
}
.drag-grip:active { cursor: grabbing; }

.tag-arrow {
  color: var(--text-3);
  transition: all var(--t);
  flex-shrink: 0;
}

/* ── Inline add form ──────────────────────────────── */
.add-form {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 6px;
  padding-bottom: 8px;
  padding-right: 40px;
  margin: 0 -40px;
  background: var(--surface);
  border-bottom: 1px solid var(--border-subtle);
}

.add-input {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 13px;
  padding: 4px 0;
  outline: none;
  transition: border-color var(--t);
}
.add-input:focus { border-bottom-color: var(--accent); }
.add-input::placeholder { color: var(--text-3); }

.add-confirm {
  background: transparent;
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  padding: 3px 8px;
  border: 1px solid rgba(201,169,110,0.3);
  border-radius: var(--radius);
  transition: all var(--t);
  flex-shrink: 0;
}
.add-confirm:hover { background: var(--accent-dim); }

.add-cancel {
  background: transparent;
  color: var(--text-3);
  font-size: 12px;
  padding: 3px 6px;
  border-radius: var(--radius);
  transition: color var(--t);
  flex-shrink: 0;
}
.add-cancel:hover { color: var(--text-2); }

/* ── Children transition ──────────────────────────── */
.tree-fade-enter-active,
.tree-fade-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
  overflow: hidden;
}
.tree-fade-enter-from,
.tree-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.mono { font-family: var(--font-mono); }
</style>
