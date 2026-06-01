import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { THEME_STORAGE_KEY } from '@/utils/theme'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import './globals.css'

export const dynamic = 'force-dynamic'

const BASE_URL = 'https://timemgr.mungji.com'

const themeScript = `
(function () {
  try {
    var stored = window.localStorage.getItem('${THEME_STORAGE_KEY}');
    var theme = stored === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (_) {
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.style.colorScheme = 'dark';
  }
})();
`

// eslint-disable-next-line react-refresh/only-export-components
export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'timemgr',
    template: '%s | timemgr',
  },
  description: '시간 추적 앱 — 태그별 스톱워치로 매 순간을 기록하세요.',
  keywords: ['time tracking', 'stopwatch', 'productivity', '시간 관리'],
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: BASE_URL,
    siteName: 'timemgr',
    title: 'timemgr — Every second accounted for.',
    description: '시간 추적 앱 — 태그별 스톱워치로 매 순간을 기록하세요.',
  },
  robots: { index: true, follow: true },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'timemgr',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
}

// eslint-disable-next-line react-refresh/only-export-components
export const viewport: Viewport = {
  themeColor: '#0c0c0c',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? ''
  return (
    <html lang="ko" data-theme="dark" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body data-nonce={nonce}>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  )
}
