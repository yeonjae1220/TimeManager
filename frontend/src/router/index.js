import { createRouter, createWebHistory } from "vue-router";
import TagList from "@/components/TagList.vue";
import TagDetail from "@/components/TagDetail.vue";
import HomeView from "@/components/HomeView.vue";
import RecordList from "@/components/RecordList.vue";

//라우트(routes) 정의 : URL 요청에 대해 어떤 페이지(컴포넌트)를 보여줄지에 대한 매핑정보를 정의
const routes = [
    { path: "/", name: 'home', component: HomeView },
    { path: "/api/tag/detail/:id", name: 'tag', component: TagDetail, props: true},
    { path: "/api/tag/:id", name: 'tags', component: TagList,}, // :id는 동적 라우트 매개변수(Dynamic Route Parameter)로, 실제 요청이 들어올 때 원하는 숫자를 넣으면 해당 숫자가 id 값으로 사용
    { path: "/records/:id", name: 'records', component: RecordList, props: true},
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;