import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

// CSP는 middleware.ts에서 nonce 기반으로 생성
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // screen-wake-lock=(self): 타이머 실행 중 화면 절전 방지(Wake Lock API) 허용
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), screen-wake-lock=(self)' },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL ?? 'http://localhost:8080'}/api/:path*`,
      },
    ]
  },
}

// Serwist: src/sw.ts → public/sw.js 로 SW 빌드.
// register/reload는 ServiceWorkerRegister 컴포넌트에서 직접 처리(CSP nonce 호환)하므로 비활성화.
// L2 보안 노트: @serwist/next moderate 취약점(via next) — fixAvailable:false, upstream 미패치.
// 프로젝트가 next를 직접 의존하므로 실질 위험 동일. next 업그레이드 시 자동 해결 예정.
const withSerwist = withSerwistInit({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  register: false,
  reloadOnOnline: false,
  // 개발 모드에서는 SW 비활성화 — HMR·캐시 충돌 방지
  disable: process.env.NODE_ENV === 'development',
})

export default withSerwist(nextConfig)
