import { ref, onScopeDispose } from 'vue';

const isOnline = ref(navigator.onLine);
const since = ref(Date.now());

function handleOnline() {
    isOnline.value = true;
    since.value = Date.now();
}

function handleOffline() {
    isOnline.value = false;
    since.value = Date.now();
}

// 전역 리스너 1회만 등록
let listenerCount = 0;

export function useNetworkStatus() {
    if (listenerCount === 0) {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
    }
    listenerCount++;

    onScopeDispose(() => {
        listenerCount--;
        if (listenerCount === 0) {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        }
    });

    return { isOnline, since };
}
