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
  // ── 태그 상세(/api/v1/tags/{id}) ─────────────────────────────────
  // 타이머 state가 포함되므로 캐시 유효기간 2분으로 단축
  {
    matcher: ({ url, sameOrigin }) => sameOrigin && /^\/api\/v1\/tags\/\d+$/.test(url.pathname),
    handler: new NetworkFirst({
      cacheName: 'tag-detail-cache',
      networkTimeoutSeconds: 3,
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 2 * 60 }),
      ],
    }),
  },
  // ── 기타 API GET — NetworkFirst (auth·records·태그상세 제외) ──────
  // auth 경로(/api/v1/auth/*)는 캐시 제외: stale 인증 상태 반환 및 로그아웃 미전달 방지
  {
    matcher: ({ url, sameOrigin }) =>
      sameOrigin &&
      url.pathname.startsWith('/api/v1/') &&
      !url.pathname.startsWith('/api/v1/auth/') &&
      !url.pathname.startsWith('/api/v1/records') &&
      !/^\/api\/v1\/tags\/\d+$/.test(url.pathname),
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
