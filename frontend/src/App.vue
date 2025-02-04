<template>
  <div id="app">
    <nav>
      <router-link to="/">home</router-link>
    </nav>
    <router-view></router-view>
  </div>
</template>

<script setup>
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  text-align: center;
  color: #2c3e50;
  margin-top: 20px;
}
h1 {
  font-size: 2rem;
  margin-bottom: 20px;
}
nav {
  background: #f8f9fa;
  padding: 10px;
}

nav a {
  margin-right: 10px;
  text-decoration: none;
  color: #007bff;
}

nav a:hover {
  text-decoration: underline;
}
</style>

<!--<template>-->
<!--  &lt;!&ndash;  <img alt="Vue logo" src="./assets/logo.png">-->
<!--    <HelloWorld msg="Welcome to Your Vue.js App"/>&ndash;&gt; &lt;!&ndash; Vue 프로젝트 생성 시 존재하는 기본 코드 제거 &ndash;&gt;-->
<!--  <div id="app">-->
<!--    <h1>Mindmap Tags</h1>-->
<!--    <TagTree :tags="tags" />-->
<!--  </div>-->
<!--  <router-view></router-view> &lt;!&ndash; router.js 맵핑된 view 적용 코드 추가 &ndash;&gt;-->
<!--</template>-->

<!--<script>-->
<!--import axios from "axios";-->
<!--import TagTree from "./components/TagTree.vue"; // TagTree 컴포넌트 import-->
<!--// import HomeView from "@/components/HomeView.vue";-->


<!--export default {-->
<!--  name: "App",-->
<!--  components: {-->
<!--    TagTree // TagTree 등록-->
<!--  },-->
<!--  data() {-->
<!--    return {-->
<!--      tags: [], // 서버에서 가져온 태그 데이터 저장-->
<!--    };-->
<!--  },-->
<!--  created() {-->
<!--    // 컴포넌트가 생성되었을 때 서버에서 태그 데이터를 가져옴-->
<!--    this.fetchTags();-->
<!--  },-->
<!--  methods: {-->
<!--    async fetchTags() {-->
<!--      try {-->
<!--        const tagId = this.$route.params.id;-->
<!--        const response = await axios.get("/api/tag/${tagId}"); // 서버 API 호출, 로그인 구현 전 이라 임시로 memberid = 1 할당 해서 테스트 예ㅓㅈㅇ-->
<!--        this.tags = response.data; // 데이터를 TagTree에 전달-->
<!--        console.log("check log = " + this.tags);-->
<!--      } catch (error) {-->
<!--        console.error("Failed to fetch tags:", error);-->
<!--      }-->
<!--    },-->
<!--  },-->
<!--};-->
<!--</script>-->

<!--<style>-->
<!--#app {-->
<!--  font-family: Avenir, Helvetica, Arial, sans-serif;-->
<!--  text-align: center;-->
<!--  color: #2c3e50;-->
<!--  margin-top: 20px;-->
<!--}-->
<!--h1 {-->
<!--  font-size: 2rem;-->
<!--  margin-bottom: 20px;-->
<!--}-->
<!--</style>-->

<!--&lt;!&ndash;-->
<!--<template>-->
<!--  <img alt="Vue logo" src="./assets/logo.png">-->
<!--  <HelloWorld msg="Welcome to Your Vue.js App"/>-->
<!--</template>-->

<!--<script>-->
<!--import HelloWorld from './components/HelloWorld.vue'-->

<!--export default {-->
<!--  name: 'App',-->
<!--  components: {-->
<!--    HelloWorld-->
<!--  }-->
<!--}-->
<!--</script>-->

<!--<style>-->
<!--#app {-->
<!--  font-family: Avenir, Helvetica, Arial, sans-serif;-->
<!--  -webkit-font-smoothing: antialiased;-->
<!--  -moz-osx-font-smoothing: grayscale;-->
<!--  text-align: center;-->
<!--  color: #2c3e50;-->
<!--  margin-top: 60px;-->
<!--}-->
<!--</style>-->
<!--&ndash;&gt;-->