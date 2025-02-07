<!-- src/views/TagList.vue -->
<!--트리 구조를 렌더링-->
<template>
  <div>
    <h1>Tag List</h1>
    <p v-if="tagList.length === 0">로딩중...</p>
    <ul v-else>
      <TagItem
          v-for="tag in tagList"
          :key="tag.id"
          :tag="tag"
          @navigate="navigateToDetail"
      />
    </ul>
<!--    <p v-if="!tagData">로딩중...</p>-->
<!--    <ul v-else>-->
<!--&lt;!&ndash;      tagData를 TagItem 컴포넌트의 model 속성으로 전달&ndash;&gt;-->
<!--      <TagItem v-if="tagData" :tag="tagData" @navigate="navigateToDetail" />-->
<!--&lt;!&ndash;      <TagItem v-bind :tag="tagData.value" @navigate="navigateToDetail"></TagItem>&ndash;&gt;-->
<!--    </ul>-->
  </div>
</template>

<script setup>
import {ref, onMounted, computed} from "vue"; // ref는 반응형 변수 선언, onMounted는 컴포넌트가 마운트될 때 실행
import { useRoute, useRouter} from "vue-router"; // 현재 URL의 id를 가져오기 위해 사용
import axios from 'axios' // 백엔드 API 호출
import TagItem from '@/components/TagItem.vue'

const tagsContainer = ref(null); // 데이터를 저장할 변수
const route = useRoute();
const router = useRouter();
const memberId = route.params.id; // 🟢 URL에서 id 가져오기

let tagData = ref(null); // 태그 데이터 저장

// 🟢 서버에서 태그 데이터 가져오기
const fetchTags = async () => {
  try {
    const response = await axios.get(`/api/tag/${Number(memberId)}`);
    console.log("서버에서 받은 태그 데이터:", response.data)
    // tagData.value = transformData(response.data);
    tagData.value = response.data;
    console.log("tagData.value:", tagData.value); // ✅ 이 부분 추가
  } catch (error) {
    console.error("Error fetching tags:", error);
  }
};

// ✅ `computed()`를 사용하여 Proxy(Array) 문제 해결
const tagList = computed(() => tagData.value ?? []);

// 추후 TagDto로 받아오는 정보 자체를 서버에서 조절할 수 도 있음
// const transformData = (data) => {
//   return {
//     id: data.id,
//     name: data.name,
//     children: data.children ? data.children.map(transformData) : [] // children이 있으면 재귀적으로 변환
//   }
// }

// 🟢 이벤트를 받아서 상세 페이지로 이동
const navigateToDetail = (tagId) => {
  console.log("✅ TagList.vue에서 받은 tagId:", tagId);
  router.push(`/api/tag/detail/${tagId}`);
};

onMounted(() => {
  console.log("✅ onMounted 실행됨!"); // ✅ 여기가 실행되는지 확인
  console.log("✅ treeContainer:", tagsContainer.value); // ✅ 요소가 존재하는지 확인
  fetchTags(); // 컴포넌트가 마운트되면 fetchTags() 호출하여 서버에서 데이터 가져옴
});
</script>