<!--<template>-->
<!--  <div v-if="tag">-->
<!--    <h1>{{ tag.name }}</h1>-->
<!--    <p>부모 태그: {{ tag.parent ? tag.parent.name : "없음" }}</p>-->
<!--    <p>총 시간: {{ tag.totalTime }} 시간</p>-->
<!--    <h3>하위 태그</h3>-->
<!--    <ul>-->
<!--      <li v-for="child in tag.children" :key="child.id">-->
<!--        <router-link :to="`/tag/${child.id}`">{{ child.name }}</router-link>-->
<!--      </li>-->
<!--    </ul>-->
<!--    <router-link to="/">홈으로</router-link>-->
<!--  </div>-->
<!--  <p v-else>로딩 중...</p>-->
<!--</template>-->

<!--<script setup>-->
<!--import { ref, onMounted } from "vue";-->
<!--import { useRoute } from "vue-router";-->
<!--import axios from "axios";-->

<!--const route = useRoute();-->
<!--const tag = ref(null);-->

<!--// 🟢 특정 태그 상세 정보 가져오기-->
<!--const fetchTagDetail = async () => {-->
<!--  try {-->
<!--    const response = await axios.get(`/api/tag/detail/${route.params.id}`);-->
<!--    tag.value = response.data;-->
<!--  } catch (error) {-->
<!--    console.error("Error fetching tag detail:", error);-->
<!--  }-->
<!--};-->

<!--onMounted(fetchTagDetail);-->
<!--</script>-->

<!--아래는 서버와의 재 통신 없이 데이터 떙겨오는 코드-->
<template>
  <div v-if="tag">
    <h1>{{ tag.name }}</h1>
    <p>부모 태그: {{ tag.parentId ? tag.parentId : "식별 안됨" }}</p>
    <p>총 시간: {{ tag.totalTime }} 시간</p>
    <h3>하위 태그</h3>
    <router-link to="/">홈으로</router-link>
  </div>
  <p v-else>로딩 중...</p>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import axios from "axios";

const route = useRoute();
const tag = ref(null);

// ✅ `history.state`에서 태그 데이터 가져오기
// TagDetail.vue에서 history.state.tag가 없을 경우 서버에서 재요청, 이렇게 하면 URL로 직접 접근했을 때도 정상적으로 데이터를 불러올 수 있음
onMounted(async () => {
  if (history.state.tag) {
    tag.value = history.state.tag;
    console.log("컴포턴트 히스토리 에서 받아온 정보", tag.value)
} else {
    try {
      const response = await axios.get(`/api/tag/detail/${route.params.id}`);
      tag.value = response.data;
      console.log("서버로 부터 받아온 태그 데이터", tag.value)
    } catch (error) {
      console.error("태그 데이터를 불러오는 중 오류 발생:", error);
    }
  }
});
</script>
