/* =====================================================================
   TimeManager — Custom Service Worker
   Phase 1 : 앱 쉘 precache + API NetworkFirst 캐싱
   Phase 2 : Background Sync (record CRUD)
   Phase 3 : Push 알림 수신
   ===================================================================== */

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
/* global clients */
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

// ── Phase 1: 앱 쉘 Precache ──────────────────────────────────────────
// Workbox InjectManifest 모드: 빌드 시 __WB_MANIFEST 자리에
// precache 목록(JS/CSS/HTML)이 삽입됨
precacheAndRoute(self.__WB_MANIFEST);

// ── Phase 1: API 호출 — NetworkFirst ─────────────────────────────────
// 네트워크 우선; 실패 시 캐시 응답 반환 (오프라인 대비)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/v1/') &&
    !url.pathname.startsWith('/api/v1/records') &&
    !/^\/api\/v1\/tags\/\d+$/.test(url.pathname),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 }),
    ],
  })
);

// 태그 상세(/api/v1/tags/{id}): 타이머 state가 포함되므로 캐시 유효기간 2분으로 단축
registerRoute(
  ({ url }) => /^\/api\/v1\/tags\/\d+$/.test(url.pathname),
  new NetworkFirst({
    cacheName: 'tag-detail-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 2 * 60 }),
    ],
  })
);

// ── Phase 2: Background Sync — record CRUD ───────────────────────────
// 오프라인 중 실패한 레코드 생성·수정·삭제 요청을
// IndexedDB 큐에 저장했다가 온라인 복귀 시 자동 재전송
const bgSyncPlugin = new BackgroundSyncPlugin('recordQueue', {
  maxRetentionTime: 24 * 60, // 24시간(분 단위) 보관
});

// POST /api/v1/records  — 레코드 생성
registerRoute(
  ({ url, request }) =>
    url.pathname === '/api/v1/records' && request.method === 'POST',
  new NetworkFirst({ plugins: [bgSyncPlugin] }),
  'POST'
);

// PUT /api/v1/records/*  — 레코드 수정
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/v1/records/') && request.method === 'PUT',
  new NetworkFirst({ plugins: [bgSyncPlugin] }),
  'PUT'
);

// DELETE /api/v1/records/*  — 레코드 삭제
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/v1/records/') && request.method === 'DELETE',
  new NetworkFirst({ plugins: [bgSyncPlugin] }),
  'DELETE'
);

// ── Phase 2.5: Background Sync — timer operations ───────────────────
// 오프라인 중 실패한 타이머 시작·종료·리셋 요청을
// IndexedDB 큐에 저장했다가 온라인 복귀 시 자동 재전송
const timerBgSyncPlugin = new BackgroundSyncPlugin('timerQueue', {
  maxRetentionTime: 24 * 60, // 24시간(분 단위) 보관
});

// POST /api/v1/tags/*/timer/start — 타이머 시작
registerRoute(
  ({ url, request }) =>
    /^\/api\/v1\/tags\/\d+\/timer\/start$/.test(url.pathname) && request.method === 'POST',
  new NetworkFirst({ plugins: [timerBgSyncPlugin] }),
  'POST'
);

// POST /api/v1/tags/*/timer/stop — 타이머 종료
registerRoute(
  ({ url, request }) =>
    /^\/api\/v1\/tags\/\d+\/timer\/stop$/.test(url.pathname) && request.method === 'POST',
  new NetworkFirst({ plugins: [timerBgSyncPlugin] }),
  'POST'
);

// POST /api/v1/tags/*/timer/reset — 타이머 리셋
registerRoute(
  ({ url, request }) =>
    /^\/api\/v1\/tags\/\d+\/timer\/reset$/.test(url.pathname) && request.method === 'POST',
  new NetworkFirst({ plugins: [timerBgSyncPlugin] }),
  'POST'
);

// ── Phase 3: Push 알림 수신 ──────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const title = data.title || 'TimeManager';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: data.url ? { url: data.url } : {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 알림 클릭 시 해당 URL로 포커스/이동
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
