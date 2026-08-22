'use client'

import { hasCapability, withPlugin } from '@/utils/nativeBridge'
import { isNativeApp } from '@/utils/platform'
import type { OngoingContent } from './ongoingContent'

/**
 * Android 실행중 표시 — 지속 알림 + Chronometer.
 *
 * Foreground Service 를 쓰지 않는다. `setUsesChronometer(true)` 는 **알림의 기능**이라
 * 서비스와 무관하고, 게시된 알림은 앱 프로세스가 죽어도 살아서 계속 흐른다
 * (API 35 실측). 재부팅과 설정의 "강제 중지"에서만 사라지는데, 후자는 FGS 를 썼어도
 * 똑같이 사라지므로 두 방식의 차이가 아니다.
 * 이 앱은 경과시간이 델타 재계산이라 백그라운드에서 셀 것도 0이다. FGS 를 빼면
 * Play 콘솔 `specialUse` 정당화 서류와 Android 14+ 백그라운드 시작 제한이 둘 다 사라진다.
 * → TM-ADR-011
 *
 * 내용 생성(문구·기준시각)은 표면과 무관하므로 `ongoingContent.ts` 에 있다 — 이 파일은
 * Android 커스텀 플러그인을 부르는 배선만 담당한다(TM-ADR-012 C3).
 */

/** Capacitor 플러그인 이름. Android 쪽 `@CapacitorPlugin(name = ...)` 과 일치해야 한다. */
export const TIMER_NOTIFICATION_PLUGIN = 'TimerNotification'

interface ShowResult {
  /**
   * 실제로 상태표시줄에 올라갔는지. API 33+ 에서 알림 권한이 없으면 시스템이 조용히
   * 버리는데 **호출 자체는 성공**하므로, 이 값 없이는 성공과 구분할 수 없다.
   */
  shown: boolean
}

interface TimerNotificationPlugin {
  show(content: OngoingContent): Promise<ShowResult>
  hide(): Promise<void>
}

/**
 * `@capacitor/core` 를 정적 import 하지 않는다 — 웹 번들 오염 방지(platform.ts 와 같은 이유).
 * 이 플러그인은 npm 패키지가 아니라 android/ 프로젝트 안에만 있으므로 `registerPlugin` 으로
 * 프록시를 만든다. 바이너리에 없으면 withPlugin 이 호출 전에 걸러낸다.
 */
async function loadPlugin(): Promise<TimerNotificationPlugin> {
  const { registerPlugin } = await import('@capacitor/core')
  return registerPlugin<TimerNotificationPlugin>(TIMER_NOTIFICATION_PLUGIN)
}

/**
 * 이 기기에서 실행중 알림을 다룰 수 있는지. 플러그인이 android/ 프로젝트 안에만
 * 있으므로 웹은 물론 **iOS 네이티브에서도 false** 다.
 *
 * "다룰 수 없다" 를 "수렴에 실패했다" 와 섞으면 안 된다 — 섞으면 iOS 에서 매 sync 마다
 * 서명이 리셋돼 무한 재수렴한다.
 */
export function supportsTimerNotification(): boolean {
  return isNativeApp() && hasCapability(TIMER_NOTIFICATION_PLUGIN)
}

/**
 * 실행중 알림을 세운다. 이미 떠 있으면 같은 id 로 덮어써 갱신된다.
 *
 * @returns 표면이 요청대로 수렴했는지 — **실제로 게시됐을 때만** true.
 *   권한 미허용·구 바이너리·웹·호출 실패는 전부 false 다. 호출부는 이 값으로
 *   재수렴 여부를 정한다(원칙 A). 웹에서도 false 라는 점에 주의 — 호출부는 이미
 *   `isNativeApp()` 으로 감싸고 있어야 한다.
 */
export async function showTimerNotification(content: OngoingContent): Promise<boolean> {
  const result = await withPlugin(TIMER_NOTIFICATION_PLUGIN, loadPlugin, (plugin) =>
    plugin.show(content),
  )
  return result?.shown === true
}

/**
 * 실행중 알림을 내린다. 떠 있지 않아도 안전하다(멱등).
 *
 * @returns 알림이 확실히 없는지. 웹·구 바이너리는 **띄운 적이 없으므로** true —
 *   여기서 false 를 주면 호출부가 영원히 재시도한다. 네이티브 호출이 실패했을 때만
 *   false 이며, 그때는 유령 알림이 남아 있을 수 있다.
 */
export async function hideTimerNotification(): Promise<boolean> {
  if (!supportsTimerNotification()) return true

  const cleared = await withPlugin(TIMER_NOTIFICATION_PLUGIN, loadPlugin, async (plugin) => {
    await plugin.hide()
    return true
  })
  return cleared === true
}
