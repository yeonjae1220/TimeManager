'use client'

import { useEffect } from 'react'
import { isNativeApp } from '../utils/platform'
import { OAUTH_CALLBACK_PATH } from '../utils/nativeOAuth'

/**
 * 네이티브 셸(Capacitor)에서만 동작하는 플랫폼 연동.
 * 웹에서는 아무것도 하지 않으며, @capacitor/app 은 동적 import 라 웹 번들에 실리지 않는다.
 *
 * - Android 하드웨어 뒤로가기:
 *   1) 열려 있는 모달이 있으면 그것만 닫는다. 이 처리가 없으면 모달을 띄운 채 뒤로가기를
 *      눌렀을 때 모달이 남은 상태로 페이지가 이동해 버린다.
 *   2) 모달이 없고 히스토리가 남아 있으면 한 단계 뒤로 간다.
 *   3) 루트에서만 앱을 종료한다(기본 동작은 무조건 종료라 그대로 두면 안 된다).
 */

/** 모달 오버레이 표식 — "오버레이 자신을 클릭하면 닫힌다"(e.target === e.currentTarget) 규약을 따른다. */
const MODAL_OVERLAY_SELECTOR = '[data-modal-overlay]'

function closeTopmostModal(): boolean {
  if (typeof document === 'undefined') return false
  const overlays = document.querySelectorAll<HTMLElement>(MODAL_OVERLAY_SELECTOR)
  if (overlays.length === 0) return false
  // 마지막에 마운트된 것이 가장 위 — 중첩 모달(기록 편집 안의 태그 선택 등)도 안쪽부터 닫힌다.
  overlays[overlays.length - 1].click()
  return true
}

export function NativeShell() {
  useEffect(() => {
    if (!isNativeApp()) return

    const removers: Array<() => void> = []
    let cancelled = false

    void (async () => {
      const [{ App }, { Browser }] = await Promise.all([
        import('@capacitor/app'),
        import('@capacitor/browser'),
      ])

      const back = await App.addListener('backButton', ({ canGoBack }) => {
        if (closeTopmostModal()) return
        if (canGoBack) {
          window.history.back()
        } else {
          void App.exitApp()
        }
      })

      // Universal/App Links 로 되돌아온 OAuth 콜백을 WebView 로 넘긴다.
      // 이 처리가 없으면 콜백이 시스템 브라우저에 남아, 그쪽에서 로그인이 끝나고
      // 앱은 로그아웃 상태로 남는다(WebView 와 브라우저는 쿠키 저장소가 분리돼 있다).
      const urlOpen = await App.addListener('appUrlOpen', ({ url }) => {
        let parsed: URL
        try {
          parsed = new URL(url)
        } catch {
          return
        }
        // 우리 콜백 경로만 처리 — 다른 딥링크는 기본 동작에 맡긴다.
        if (parsed.origin !== window.location.origin) return
        if (!parsed.pathname.startsWith(OAUTH_CALLBACK_PATH)) return

        void Browser.close()
        // 같은 오리진이므로 일반 내비게이션. 콜백 페이지가 code 를 읽어 교환하고,
        // state(CSRF)는 WebView 스토리지에 남아 있어 그대로 검증된다.
        window.location.assign(parsed.pathname + parsed.search)
      })

      if (cancelled) {
        void back.remove()
        void urlOpen.remove()
      } else {
        removers.push(() => void back.remove(), () => void urlOpen.remove())
      }
    })()

    return () => {
      cancelled = true
      removers.forEach((fn) => fn())
    }
  }, [])

  return null
}
