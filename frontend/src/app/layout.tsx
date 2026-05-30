import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'

export const dynamic = 'force-dynamic'

const BASE_URL = 'https://timemgr.mungji.com'

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
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? ''
  return (
    <html lang="ko">
      <body data-nonce={nonce}>{children}</body>
    </html>
  )
}
