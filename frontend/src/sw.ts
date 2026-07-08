/// <reference lib="webworker" />
/* =====================================================================
   TimeManager — Service Worker (serwist)
   Phase 1 : 앱 쉘 precache + API NetworkFirst 캐싱
   Phase 2 : Background Sync (record CRUD)
   Phase 3 : Push 알림 수신
   ===================================================================== */

import {
  Serwist,
  NetworkFirst,
  ExpirationPlugin,
  CacheableResponsePlugin,
  BackgroundSyncPlugin,
  type PrecacheEntry,
  type SerwistGlobalConfig,
  type RuntimeCaching,
} from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // serwist가 빌드 시 precache 목록(JS/CSS/HTML)을 주입하는 자리
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

// ── Phase 2: Background Sync — record CRUD ───────────────────────────
// 오프라인 중 실패한 레코드 생성·수정·삭제 요청을 IndexedDB 큐에 저장했다가
// 온라인 복귀 시 자동 재전송 (최대 24시간 보관)
const recordSyncPlugin = new BackgroundSyncPlugin('recordQueue', {
  maxRetentionTime: 24 * 60,
})

const runtimeCaching: RuntimeCaching[] = [
  // ── 기타 API GET — NetworkFirst (auth·records·tags 제외) ──────────
  // 태그 API(/api/v1/tags*)는 캐시 금지: 응답에 타이머 state(running)·latestStartTime이
  // 실려 있어, NetworkFirst가 느린 네트워크(3초 타임아웃)에서 stale "running" 스냅샷을
  // 서빙하면 정지된 태그가 계속 실행중으로 보이는 유령 러닝이 발생한다. 이 캐시는 앱
  // 로컬 SW Cache Storage라 localStorage/IndexedDB 초기화로도 안 사라진다. 태그 오프라인은
  // tagStore의 IndexedDB 캐시가 담당하므로 SW 레벨 태그 캐싱은 불필요하다.
  // auth 경로(/api/v1/auth/*)도 제외: stale 인증 상태 반환 및 로그아웃 미전달 방지.
  {
    matcher: ({ url, sameOrigin }) =>
      sameOrigin &&
      url.pathname.startsWith('/api/v1/') &&
      !url.pathname.startsWith('/api/v1/auth/') &&
      !url.pathname.startsWith('/api/v1/records') &&
      !url.pathname.startsWith('/api/v1/tags'),
    handler: new NetworkFirst({
      cacheName: 'api-cache',
      networkTimeoutSeconds: 3,
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 }),
      ],
    }),
  },
  // ── record CRUD — Background Sync ────────────────────────────────
  {
    matcher: ({ url, request, sameOrigin }) =>
      sameOrigin && url.pathname === '/api/v1/records' && request.method === 'POST',
    method: 'POST',
    handler: new NetworkFirst({ plugins: [recordSyncPlugin] }),
  },
  {
    matcher: ({ url, request, sameOrigin }) =>
      sameOrigin && url.pathname.startsWith('/api/v1/records/') && request.method === 'PUT',
    method: 'PUT',
    handler: new NetworkFirst({ plugins: [recordSyncPlugin] }),
  },
  {
    matcher: ({ url, request, sameOrigin }) =>
      sameOrigin && url.pathname.startsWith('/api/v1/records/') && request.method === 'DELETE',
    method: 'DELETE',
    handler: new NetworkFirst({ plugins: [recordSyncPlugin] }),
  },
]

// ── 타이머 API (timer/start·stop·reset)는 BackgroundSync 미사용 ──────
// tagStore의 온라인 리스너에서 수동 재전송 → SW 큐와 중복 시 record 이중 생성 방지

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // 배포 후 새 SW 즉시 활성화 + 열린 탭 즉시 제어
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
})

serwist.addEventListeners()

// ── 과거 SW가 캐싱한 타이머 state stale 응답 정리 ────────────────────
// 라우트에서 태그 API 캐싱을 제거했더라도, 이미 설치된 클라이언트의 Cache Storage엔
// 과거 SW가 저장한 stale "running" 스냅샷(tag-detail-cache·api-cache)이 남아있어
// 유령 러닝을 계속 유발한다. 새 SW 활성화 시 해당 캐시를 삭제해 즉시 정리한다.
// (skipWaiting+clientsClaim으로 다음 앱 로드에 새 SW가 활성화됨)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await Promise.all([caches.delete('tag-detail-cache'), caches.delete('api-cache')])
    })()
  )
})

// ── Phase 3: Push 알림 수신 ──────────────────────────────────────────
// TODO: 서버 측 Web Push 구독(subscribe)·발송 구현 후 실제 동작.
//       현재는 SW 수신 레이어만 준비된 상태.
self.addEventListener('push', (event) => {
  if (!event.data) return

  let data: { title?: string; body?: string; url?: string } = {}
  try {
    data = event.data.json()
  } catch {
    // malformed JSON payload — 기본값으로 알림 표시
  }

  const title = data.title || 'TimeManager'
  const options: NotificationOptions = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: data.url ? { url: data.url } : {},
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// 알림 클릭 시 해당 URL로 포커스/이동
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // 절대 경로 외 값(javascript: 등)은 루트로 대체 — 악성 payload 방어
  const raw: unknown = event.notification.data?.url
  const url = typeof raw === 'string' && raw.startsWith('/') ? raw : '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
