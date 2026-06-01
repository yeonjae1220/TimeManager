import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  const csp = [
    "default-src 'self'",
    // 'unsafe-inline': nonce+strict-dynamic 지원 브라우저(모던)에서는 strict-dynamic이 override하여 무력화됨.
    // nonce 미지원 구버전 브라우저 전용 fallback — 이 앱은 모던 브라우저만 지원하므로 실질 위험 없음.
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://timemgr.mungji.com",
    // Service Worker(/sw.js) 로드 — strict-dynamic 전파가 브라우저마다 달라 명시
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  // _next/static, icons 등 정적 에셋은 CSP 헤더 불필요하므로 제외.
  // /sw.js는 매처에 포함되어 CSP 헤더를 받지만, SW 내부 fetch는 미들웨어를
  // 거치지 않으므로 SW 동작에 영향 없음. worker-src는 위 csp 배열에서 명시.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons).*)',
  ],
}
