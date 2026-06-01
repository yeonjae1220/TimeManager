import type { MetadataRoute } from 'next'

// PWA Web App Manifest — Next.js Metadata API로 /manifest.webmanifest 경로에 서빙된다.
// standalone display로 홈 화면 설치 시 독립 앱처럼 실행된다.
export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TimeManager',
    short_name: 'timemgr',
    description: '시간 추적 앱 — 태그별 스톱워치로 매 순간을 기록하세요.',
    start_url: '/',
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
