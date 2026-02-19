<template>
  <div class="page">
    <div class="topbar">
      <span class="topbar-brand">timemgr</span>
      <router-link to="/" class="topbar-back">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M10.5 6.5h-8M6 3L2.5 6.5 6 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Home
      </router-link>
    </div>

    <header class="list-header">
      <div class="list-header-left">
        <p class="list-eyebrow mono">workspace</p>
        <h1 class="list-title">Tags</h1>
      </div>
      <span class="list-count mono" v-if="tagList.length">{{ tagList.length }}</span>
    </header>

    <div v-if="tagList.length === 0" class="empty-state">
      <span class="dot stopped"></span>
      <span class="mono">Loading workspace…</span>
    </div>

    <ul v-else class="tag-tree">
      <TagItem
        v-for="tag in tagList"
        :key="tag.id"
        :tag="tag"
        @navigate="navigateToDetail"
      />
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import TagItem from '@/components/TagItem.vue';

const route = useRoute();
const router = useRouter();
const memberId = route.params.id;

const tagData = ref(null);

const fetchTags = async () => {
  try {
    const response = await axios.get(`/api/tag/${Number(memberId)}`);
    tagData.value = response.data;
  } catch (error) {
    console.error('Error fetching tags:', error);
  }
};

const tagList = computed(() => tagData.value ?? []);

const navigateToDetail = (tagId) => {
  router.push(`/api/tag/detail/${tagId}`);
};

onMounted(fetchTags);
</script>

<style scoped>
.list-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 52px 0 28px;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 0;
}

.list-eyebrow {
  font-size: 10px;
  color: var(--text-2);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin-bottom: 10px;
}

.list-title {
  font-family: var(--font-serif);
  font-size: 34px;
  color: var(--text);
  font-weight: 400;
}

.list-count {
  font-size: 12px;
  color: var(--text-3);
  padding-bottom: 4px;
}

.empty-state {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 56px 0;
  color: var(--text-2);
  font-size: 13px;
}

.tag-tree { padding: 4px 0; }

.mono { font-family: var(--font-mono); }
</style>
