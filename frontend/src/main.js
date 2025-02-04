import { createApp } from 'vue'
import App from './App.vue'
import router from './router';

/*
라우터 플러그인 등록하기
한 번 라우터 인스턴스를 생성한 후, 애플리케이션에서 use()를 호출하여 플러그인으로 등록해야 합니다:
 */
createApp(App).use(router).mount('#app')
