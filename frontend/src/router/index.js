import { createRouter, createWebHistory } from "vue-router";
import TagTree from "@/components/TagTree.vue";
import TagDetail from "@/views/TagDetail.vue";
import HomeView from "@/components/HomeView.vue";

//라우트(routes) 정의 : URL 요청에 대해 어떤 페이지(컴포넌트)를 보여줄지에 대한 매핑정보를 정의
const routes = [
    { path: "/", name: 'home', component: HomeView },
    { path: "/api/tag/detail/:id", name: 'tag', component: TagDetail },
    { path: "/api/tag/:id", name: 'tags', component: TagTree }, // :id는 동적 라우트 매개변수(Dynamic Route Parameter)로, 실제 요청이 들어올 때 원하는 숫자를 넣으면 해당 숫자가 id 값으로 사용

];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;