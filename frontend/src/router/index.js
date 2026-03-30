import { createRouter, createWebHistory } from "vue-router";
import TagList from "@/components/TagList.vue";
import TagDetail from "@/components/TagDetail.vue";
import RecordList from "@/components/RecordList.vue";
import LoginView from "@/views/LoginView.vue";
import RegisterView from "@/views/RegisterView.vue";
import OAuthCallbackView from "@/views/OAuthCallbackView.vue";
import ProfileView from "@/views/ProfileView.vue";
import LandingView from "@/views/LandingView.vue";

const routes = [
    { path: "/", name: 'landing', component: LandingView },
    { path: "/login", name: 'login', component: LoginView },
    { path: "/register", name: 'register', component: RegisterView },
    { path: "/oauth/callback", name: 'oauthCallback', component: OAuthCallbackView },
    { path: "/tags/:id", name: 'tag', component: TagDetail, props: true, meta: { requiresAuth: true } },
    { path: "/members/:id/tags", name: 'tags', component: TagList, meta: { requiresAuth: true } },
    { path: "/records/:id", name: 'records', component: RecordList, props: true, meta: { requiresAuth: true } },
    { path: "/profile", name: 'profile', component: ProfileView, meta: { requiresAuth: true } },
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
