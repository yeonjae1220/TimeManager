import { register } from 'register-service-worker';

if (process.env.NODE_ENV === 'production') {
  register(`${process.env.BASE_URL}service-worker.js`, {
    ready() {
      console.log('[SW] 앱이 서비스 워커를 통해 캐시에서 제공됩니다.');
    },
    registered(registration) {
      console.log('[SW] 서비스 워커가 등록되었습니다.');
      // 주기적으로 업데이트 확인 (1시간마다)
      setInterval(() => registration.update(), 60 * 60 * 1000);
    },
    cached() {
      console.log('[SW] 앱 콘텐츠가 오프라인 사용을 위해 캐시되었습니다.');
    },
    updatefound() {
      console.log('[SW] 새로운 콘텐츠를 다운로드 중입니다.');
    },
    updated(registration) {
      console.log('[SW] 새로운 콘텐츠가 사용 가능합니다. 페이지를 새로고침하세요.');
      // 새 SW에게 즉시 제어권을 넘기도록 알림
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      document.dispatchEvent(new CustomEvent('swUpdated', { detail: registration }));
    },
    offline() {
      console.log('[SW] 인터넷 연결이 없습니다. 앱이 오프라인 모드로 실행됩니다.');
    },
    error(error) {
      console.error('[SW] 서비스 워커 등록 중 오류 발생:', error);
    },
  });
}
