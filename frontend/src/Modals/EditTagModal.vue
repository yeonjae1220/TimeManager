<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="closeModal">
    <div class="modal-panel">

      <div class="modal-header">
        <h2 class="modal-title">Manage Tag</h2>
        <button class="modal-close" @click="closeModal">×</button>
      </div>

      <!-- Create sub-tag -->
      <div class="modal-section">
        <span class="modal-section-label">New sub-tag</span>
        <div class="field">
          <label>Tag name</label>
          <input v-model="newTagName" type="text" placeholder="Enter name…" @keydown.enter="createTag" />
        </div>
        <div class="section-action">
          <button class="btn btn-primary" @click="createTag">Create</button>
        </div>
      </div>

      <!-- Move parent -->
      <div class="modal-section">
        <span class="modal-section-label">Move to parent</span>
        <div class="field">
          <label>New parent</label>
          <select v-model="selectedParentId">
            <option value="" disabled>Select a tag…</option>
            <option v-for="t in flatTagList" :key="t.id" :value="t.id">
              {{ t.indentation }}{{ t.name }}
            </option>
          </select>
        </div>
        <div class="section-action">
          <button class="btn btn-ghost" @click="updateParentTag">Move</button>
        </div>
      </div>

      <!-- Delete -->
      <div class="modal-section danger-section">
        <span class="modal-section-label">Danger zone</span>
        <div class="danger-row">
          <p class="danger-desc">Move this tag to the discard pile. This cannot be undone easily.</p>
          <button class="btn btn-danger" @click="deleteTag">Discard tag</button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, defineProps, watchEffect, computed } from 'vue';
import axios from 'axios';

const props = defineProps({
  isOpen:  Boolean,
  tagData: Object,
});

const emit = defineEmits(['close']);

const newTagName      = ref('');
const selectedParentId = ref('');
const tagList         = ref([]);
const discardedTag    = ref(null);

const fetchTags = async () => {
  try {
    const response = await axios.get(`/api/tag/${Number(props.tagData.memberId)}`);
    tagList.value = response.data;
    discardedTag.value = tagList.value.find((t) => t.type === 'DISCARDED') || null;
  } catch (error) {
    console.error('태그 목록 가져오기 실패', error);
  }
};

watchEffect(() => { if (props.isOpen) fetchTags(); });

const flatTagList = computed(() => {
  const flatten = (tags, depth = 0) => {
    const result = [];
    tags.forEach((t) => {
      if (t.type === 'DISCARDED') {
        discardedTag.value = t;
      } else {
        result.push({ ...t, indentation: '— '.repeat(depth) });
        if (t.children?.length > 0) result.push(...flatten(t.children, depth + 1));
      }
    });
    return result;
  };
  return flatten(tagList.value.filter((t) => t.type !== 'DISCARDED'));
});

const createTag = async () => {
  if (!newTagName.value.trim()) return;
  try {
    await axios.post(`/api/tag/${Number(props.tagData.id)}/create`, {
      tagName:     newTagName.value,
      memberId:    props.tagData.memberId,
      parentTagId: props.tagData.parentId,
    });
    newTagName.value = '';
    fetchTags();
  } catch (error) {
    console.error('태그 생성 실패', error);
  }
};

const updateParentTag = async () => {
  if (!selectedParentId.value) return;
  try {
    await axios.put(`/api/tag/${Number(props.tagData.id)}/updateParent`, {
      newParentTagId: selectedParentId.value,
    });
    closeModal();
  } catch (error) {
    console.error('부모 태그 변경 실패', error);
  }
};

const deleteTag = async () => {
  if (!confirm('이 태그를 삭제하시겠습니까?')) return;
  try {
    await axios.put(`/api/tag/${Number(props.tagData.id)}/updateParent`, {
      newParentTagId: discardedTag.value.id,
    });
    closeModal();
  } catch (error) {
    console.error('태그 삭제 실패', error);
  }
};

const closeModal = () => emit('close');
</script>

<style scoped>
.section-action {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.danger-section { border-bottom: none !important; }

.danger-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.danger-desc {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.6;
  max-width: 220px;
}
</style>
