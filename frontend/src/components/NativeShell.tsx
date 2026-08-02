'use client'

import { useEffect } from 'react'
import { isNativeApp } from '../utils/platform'

/**
 * 네이티브 셸(Capacitor)에서만 동작하는 플랫폼 연동.
 * 웹에서는 아무것도 하지 않으며, @capacitor/app 은 동적 import 라 웹 번들에 실리지 않는다.
 *
 * - Android 하드웨어 뒤로가기: 기본 동작이 "앱 종료"라 그대로 두면 화면 한 단계 뒤로 가는 대신
 *   앱이 바로 꺼진다. 히스토리가 남아 있으면 뒤로 가고, 루트에서만 종료한다.
 */
export function NativeShell() {
  useEffect(() => {
    if (!isNativeApp()) return

    let remove: (() => void) | undefined
    let cancelled = false

    void (async () => {
      const { App } = await import('@capacitor/app')
      const handle = await App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back()
        } else {
          void App.exitApp()
        }
      })
      if (cancelled) void handle.remove()
      else remove = () => void handle.remove()
    })()

    return () => {
      cancelled = true
      remove?.()
    }
  }, [])

  return null
}
