import axios from 'axios';

/**
 * Base64 URL-safe 문자열을 Uint8Array로 변환 (VAPID publicKey 파싱용)
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * 현재 push 구독 상태 확인
 * @returns {Promise<PushSubscription|null>}
 */
export async function getCurrentSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/**
 * 알림 권한 요청 → Push 구독 생성 → 서버 전송
 * @param {number|string} memberId
 * @returns {Promise<'subscribed'|'denied'|'unsupported'>}
 */
export async function subscribePush(memberId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Push] 이 브라우저는 Push 알림을 지원하지 않습니다.');
    return 'unsupported';
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('[Push] 알림 권한이 거부되었습니다.');
    return 'denied';
  }

  const reg = await navigator.serviceWorker.ready;

  // 이미 구독 중이면 재사용
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    const vapidKey = process.env.VUE_APP_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.error('[Push] VUE_APP_VAPID_PUBLIC_KEY 환경변수가 설정되지 않았습니다.');
      return 'unsupported';
    }
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  await axios.post(`/api/v1/push/subscriptions/${memberId}`, subscription.toJSON(), {
    headers: { 'Content-Type': 'application/json' },
  });

  console.log('[Push] 구독 완료:', subscription.endpoint);
  return 'subscribed';
}

/**
 * Push 구독 해제 및 서버에 삭제 요청
 * @param {number|string} memberId
 */
export async function unsubscribePush(memberId) {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;

  await axios.delete(`/api/v1/push/subscriptions/${memberId}`, {
    data: { endpoint: subscription.endpoint },
    headers: { 'Content-Type': 'application/json' },
  });

  await subscription.unsubscribe();
  console.log('[Push] 구독 해제 완료');
}
