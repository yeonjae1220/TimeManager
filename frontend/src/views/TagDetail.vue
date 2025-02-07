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
    <p>부모 태그:
      <router-link v-if="tag.parentId" :to="'/api/tag/detail/' + tag.parentId">부모 태그 보기</router-link>
      <span v-else>식별 안됨</span></p>
    <p>총 시간: {{ tag.totalTime }} 시간</p>
    <h3>하위 태그</h3>
    <!-- 자식 태그 리스트 표시 -->
    <ul v-if="tag.childrenList && tag.childrenList.length > 0">
      <li v-for="childId in tag.childrenList" :key="childId">
        <router-link :to="'/api/tag/detail/' + childId">{{ childId }}</router-link>
      </li>
    </ul>
    <router-link to="/">홈으로</router-link>
  </div>
  <p v-else>로딩 중...</p>
</template>

<script setup>
import { ref, onMounted, watch} from "vue";
import { useRoute } from "vue-router";
import axios from "axios";

const route = useRoute();
const tag = ref(null);

// ✅ `history.state`에서 태그 데이터 가져오기
const fetchTagData = async (tagId) => {
  try {
    const response = await axios.get(`/api/tag/detail/${tagId}`);
    tag.value = response.data;
    console.log("서버로부터 받아온 태그 데이터", tag.value);
  } catch (error) {
    console.error("태그 데이터를 불러오는 중 오류 발생:", error);
  }
};

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

  // 처음 페이지가 로드될 때, history.state.tag가 있을 경우 그 데이터를 사용하고, 없으면 라우터에서 tag.id를 받아와 데이터를 요청함.
  onMounted(() => {
    if (history.state.tag) {
      tag.value = history.state.tag;
      console.log("컴포넌트 히스토리에서 받아온 정보", tag.value);
    } else {
      fetchTagData(route.params.id);
    }
  });

// ✅ `watch`를 사용하여 라우터 파라미터 변경 시 데이터 갱신
// route.params.id를 감시하여 라우터 ID가 변경될 때마다 fetchTagData()를 호출해 새로운 데이터를 요청함. (변경됨)
// ✅ `watch`에서 특정 페이지(`/tag/:id`)일 때만 데이터 갱신
  watch(
      () => route.params.id,  // 라우터 ID가 변경될 때
      (newId, oldId) => {
        if (route.name === 'tag') {
          console.log("🔄 라우터 ID 변경됨:", oldId, "->", newId);
          fetchTagData(newId); // 새로운 ID로 데이터를 다시 불러옴
        } else {
          console.log("⏭ 다른 페이지 이동 → 데이터 요청 안 함");
        }
      }
  );
  // 자식 태그가 정상적으로 들어오는지 확인
  if (tag.value) {
    console.log("✅ 자식 태그 데이터:", tag.value.children);
  }
});
</script>
