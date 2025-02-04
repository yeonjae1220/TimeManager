<!-- src/components/TagNode.vue -->
<template>
  <li>
    <span @click="goToDetail">{{ tag.name }}</span>
    <ul v-if="tag.children && tag.children.length">
      <TagNode v-for="child in tag.children" :key="child.id" :tag="child" />
    </ul>
  </li>
</template>

<script setup>
import { useRouter } from "vue-router";

// ✅ 부모 컴포넌트에서 `tag` 객체를 받음
const props = defineProps({
  tag: Object,
}); // ✅ Vue 3에서 `<script setup>` 구문 사용 시 정의되는 컴파일러 매크로

const router = useRouter();

// 🟢 클릭하면 상세 페이지로 이동
const goToDetail = () => {
  router.push(`/tag/detail/${props.tag.id}`);
};
</script>

<style>
li {
  list-style-type: none;
  margin: 10px 0;
  cursor: pointer;
}

li span {
  color: #007bff;
  text-decoration: underline;
}

li span:hover {
  color: #0056b3;
}
</style>