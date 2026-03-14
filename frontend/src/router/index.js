import { createRouter, createWebHistory } from "vue-router";
import TagList from "@/components/TagList.vue";
import TagDetail from "@/components/TagDetail.vue";
import HomeView from "@/components/HomeView.vue";
import RecordList from "@/components/RecordList.vue";
import LoginView from "@/views/LoginView.vue";
import RegisterView from "@/views/RegisterView.vue";

const routes = [
    { path: "/login", name: 'login', component: LoginView },
    { path: "/register", name: 'register', component: RegisterView },
    { path: "/", name: 'home', component: HomeView, meta: { requiresAuth: true } },
    { path: "/api/tag/detail/:id", name: 'tag', component: TagDetail, props: true, meta: { requiresAuth: true } },
    { path: "/api/tag/:id", name: 'tags', component: TagList, meta: { requiresAuth: true } },
    { path: "/records/:id", name: 'records', component: RecordList, props: true, meta: { requiresAuth: true } },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

router.beforeEach((to, from, next) => {
    if (!to.meta.requiresAuth) return next();
    const raw = localStorage.getItem('auth');
    const accessToken = raw ? JSON.parse(raw)?.accessToken : null;
    if (!accessToken) return next('/login');
    next();
});

export default router;