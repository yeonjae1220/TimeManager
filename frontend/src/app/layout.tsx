import type { Metadata, Viewport } from 'next'
import { headers, cookies } from 'next/headers'
import { THEME_STORAGE_KEY } from '@/utils/theme'
import { resolveUiLang, LANG_KEY } from '@/i18n/messages/index'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import { Providers } from './providers'
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
  description: 'A time tracking app — capture every moment with a per-tag stopwatch.',
  keywords: ['time tracking', 'stopwatch', 'productivity', 'time management'],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: BASE_URL,
    siteName: 'timemgr',
    title: 'timemgr — Every second accounted for.',
    description: 'A time tracking app — capture every moment with a per-tag stopwatch.',
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
  const hdrs = await headers()
  const nonce = hdrs.get('x-nonce') ?? ''
  // 쿠키(명시적 선호) → Accept-Language(브라우저 기본) 순으로 초기 언어를 결정한다.
  // Accept-Language를 보면 첫 방문(쿠키 없음)에도 SSR이 navigator.language와 일치해
  // hydration 후 깜빡임이 사라진다. resolveUiLang이 앞 2자만 보므로 'ko-KR,...' 형태도 안전.
  const cookieLang = (await cookies()).get(LANG_KEY)?.value
  const lang = resolveUiLang(cookieLang ?? hdrs.get('accept-language'))
  return (
    <html lang={lang} data-theme="dark" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body data-nonce={nonce}>
        <ServiceWorkerRegister />
        <Providers initialLanguage={lang}>{children}</Providers>
      </body>
    </html>
  )
}
