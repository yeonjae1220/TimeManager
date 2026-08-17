'use client'

import { withPlugin } from '@/utils/nativeBridge'

/**
 * 로컬 알림 권한. 요청 시점이 중요해서 별도 모듈로 뺐다.
 *
 * 첫 실행에 곧바로 묻지 않는다 — 맥락 없는 권한 요청은 거부율이 높고, 한 번 거부되면
 * iOS 는 앱 안에서 다시 물을 수 없다(설정 앱으로 가야 한다). 그래서 "목표 시간을 처음
 * 설정할 때" 또는 "타이머를 처음 시작할 때"처럼 알림이 왜 필요한지 자명한 순간에만 묻는다.
 */

export const NOTIFICATION_PLUGIN = 'LocalNotifications'

/** granted 이외는 전부 "지금은 알림을 못 띄운다"는 뜻이다. */
export type NotificationPermission = 'granted' | 'denied' | 'prompt' | 'unavailable'

function normalize(display: string | undefined): NotificationPermission {
  if (display === 'granted') return 'granted'
  if (display === 'denied') return 'denied'
  if (display === 'prompt' || display === 'prompt-with-rationale') return 'prompt'
  return 'unavailable'
}

/** 현재 권한 상태. 요청하지 않는다(사용자에게 아무것도 보이지 않는다). */
export async function checkNotificationPermission(): Promise<NotificationPermission> {
  const result = await withPlugin(
    NOTIFICATION_PLUGIN,
    () => import('@capacitor/local-notifications'),
    async ({ LocalNotifications }) => normalize((await LocalNotifications.checkPermissions()).display),
  )
  return result ?? 'unavailable'
}

/**
 * 필요하면 권한을 요청하고, 알림을 띄울 수 있는지 돌려준다.
 * 이미 거부된 상태면 **다시 묻지 않는다** — iOS 에서는 두 번째 요청이 시스템 다이얼로그
 * 없이 즉시 denied 로 떨어지고, Android 도 영구 거부 후에는 같다. 반복 호출이 조용히
 * 실패하는 대신 false 를 돌려주고, 안내는 프로필 화면이 맡는다.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await checkNotificationPermission()
  if (current !== 'prompt') return current === 'granted'

  const requested = await withPlugin(
    NOTIFICATION_PLUGIN,
    () => import('@capacitor/local-notifications'),
    async ({ LocalNotifications }) => normalize((await LocalNotifications.requestPermissions()).display),
  )
  return requested === 'granted'
}
