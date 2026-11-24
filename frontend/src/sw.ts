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

// 오프라인 콜드 스타트용 문서 캐시. 새 배포가 활성화되면 통째로 비운다(아래 activate 참조)
// — 옛 HTML은 이미 사라진 해시 청크를 가리켜 앱이 깨지기 때문이다.
const DOCUMENT_CACHE = 'document-cache'

const runtimeCaching: RuntimeCaching[] = [
  // ── 내비게이션 문서 — NetworkFirst ───────────────────────────────
  // 이게 없으면 오프라인에서 앱을 켤 수 없다(프리캐시에는 HTML이 없고 모든 라우트가
  // 동적 SSR이라, 문서 요청이 네트워크로 떨어져 그대로 실패한다).
  // 문서 캐싱이 안전한 이유: app/ 12개 중 11개가 'use client' 라 HTML에 사용자
  // 데이터가 없다. 타이머 state가 실린 태그 API를 캐싱하지 않는다는 원칙은 그대로다.
  // oauth 콜백은 1회용 code가 URL에 있어 캐싱 대상에서 제외한다.
  {
    matcher: ({ request, url, sameOrigin }) =>
      sameOrigin &&
      request.mode === 'navigate' &&
      !url.pathname.startsWith('/oauth/') &&
      !url.pathname.startsWith('/api/') &&
      !url.pathname.startsWith('/health/'),
    handler: new NetworkFirst({
      cacheName: DOCUMENT_CACHE,
      networkTimeoutSeconds: 3,
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 7 * 24 * 60 * 60 }),
      ],
    }),
  },
  // Authenticated API reads are network-only. Offline tag state is stored in the
  // app's member-scoped store, so a shared browser cache cannot return another member's data.
  // ── record CRUD — Background Sync ────────────────────────────────
  {
    matcher: ({ url, request, sameOrigin }) =>
      sameOrigin && url.pathname === '/api/v1/records' && !url.searchParams.has('interactive') && request.method === 'POST',
    method: 'POST',
    handler: new NetworkFirst({ plugins: [recordSyncPlugin] }),
  },
  {
    matcher: ({ url, request, sameOrigin }) =>
      sameOrigin && url.pathname.startsWith('/api/v1/records/') && !url.searchParams.has('interactive') && request.method === 'PUT',
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
  // 캐시에도 없는 경로로 오프라인 진입했을 때의 최후 안전망.
  // public/offline.html 은 정적 파일이라 프리캐시 매니페스트에 포함된다.
  fallbacks: {
    entries: [
      {
        url: '/offline.html',
        matcher: ({ request }) => request.mode === 'navigate',
      },
    ],
  },
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
      await Promise.all([
        caches.delete('tag-detail-cache'),
        caches.delete('api-cache'),
        caches.delete('records-cache'),
        // 새 배포의 SW가 활성화되면 옛 문서는 무효다 — 이미 삭제된 해시 청크를
        // 참조해 앱이 흰 화면으로 깨진다. 다음 온라인 방문 때 다시 채워진다.
        caches.delete(DOCUMENT_CACHE),
      ])
    })()
  )
})

// ── Phase 3: Push 알림 수신 ──────────────────────────────────────────
// TODO: 서버 측 Web Push 구독(subscribe)·발송 구현 후 실제 동작.
//       현재는 SW 수신 레이어만 준비된 상태.
//
// ⚠️ 네이티브 앱(Capacitor)에서는 이 경로가 절대 동작하지 않는다. WKWebView 가
//    Push API 를 지원하지 않기 때문이다(백엔드의 VAPID 설비도 마찬가지로 무용).
//    네이티브 알림은 기기에서 스케줄하는 로컬 알림으로 간다 — src/native/runningSession.ts.
//    이 핸들러는 PWA(홈 화면에 추가) 경로에서만 유효하므로 남겨둔다.
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
