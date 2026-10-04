import type { MetadataRoute } from 'next'

// PWA Web App Manifest — Next.js Metadata API로 /manifest.webmanifest 경로에 서빙된다.
// standalone display로 홈 화면 설치 시 독립 앱처럼 실행된다.
export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TimeManager',
    short_name: 'timemgr',
    description: 'A time tracking app — capture every moment with a per-tag stopwatch.',
    // 홈 화면 앱은 랜딩(/)을 거치지 않고 타이머 화면으로 바로 연다 — 랜딩에서 다시
    // /members/{id}/today 로 이동하면 서버 왕복이 하나 더 붙어 콜드 스타트마다 스켈레톤이
    // 그만큼 길어진다. 로그아웃 상태면 보호 레이아웃이 /login 으로 보낸다.
    // ⚠️ iOS 는 홈 화면에 추가하는 순간의 start_url 을 저장해 두므로, 이미 추가한 아이콘은
    // 지우고 다시 추가해야 바뀐다.
    start_url: '/today',
    // id 를 생략하면 start_url 이 곧 앱 정체성이 된다. 예전 값('/')으로 고정해 두지 않으면
    // 이미 설치된 앱(Android·데스크톱 Chrome)이 다른 앱으로 취급돼 매니페스트 갱신을 못 받는다.
    id: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0c0c0c',
    theme_color: '#0c0c0c',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
