<template>
  <li class="tag-item">
    <!-- 클릭하면 상세 페이지로 이동 -->
    <div class="tag-box" @click="navigateToDetail">
      {{ tag.name }}
    </div>
    <!-- 자식 태그 재귀적으로 렌더링 -->
    <ul v-if="tag.children && tag.children.length > 0" class="child-tags">
      <TagItem
          v-for="child in tag.children"
          :key="child.id"
          :tag="child"
          @navigate="$emit('navigate', $event)"
      />
    </ul>
  </li>
</template>

<script>
export default {
  name: "TagItem",
  props: {
    tag: {
      type: Object,
      required: true,
    },
  },
  methods: {
    navigateToDetail() {
      this.$emit("navigate", this.tag.id);
    },
  },
};
</script>