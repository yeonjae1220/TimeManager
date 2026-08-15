'use client'

// Capacitor 네이티브 셸은 WebView에 window.Capacitor 브리지를 주입한다.
// @capacitor/core를 정적 import하면 웹 번들에도 실리므로, 전역 브리지만 확인한다.
declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean
      getPlatform?: () => 'ios' | 'android' | 'web'
    }
  }
}

/** Capacitor 네이티브 셸(iOS/Android) 안에서 실행 중인지. 웹에서는 항상 false. */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  return window.Capacitor?.isNativePlatform?.() === true
}

/** 네이티브 플랫폼 이름. 웹에서는 'web'. */
export function getNativePlatform(): 'ios' | 'android' | 'web' {
  if (typeof window === 'undefined') return 'web'
  return window.Capacitor?.getPlatform?.() ?? 'web'
}
