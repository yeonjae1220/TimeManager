'use client'

import { useEffect } from 'react'

// Service Worker 등록 — serwist의 자동 inline 주입(register:false) 대신
// 클라이언트 모듈에서 직접 등록한다. nonce 기반 CSP(strict-dynamic) 하에서
// inline 스크립트는 차단되지만, 번들된 client 모듈은 nonce로 로드되므로 안전하다.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    // SW는 secure context(HTTPS/localhost)에서만 동작
    if (!window.isSecureContext) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((e) => {
        console.warn('Service Worker 등록 실패:', e)
      })
    }

    // 첫 페인트를 막지 않도록 load 이후 등록
    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}
