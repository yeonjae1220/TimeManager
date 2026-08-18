'use client'

import { hasCapability, withPlugin } from '@/utils/nativeBridge'
import { isNativeApp } from '@/utils/platform'
import type { NativeRunningSession } from './runningSession'

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
 * 네이티브는 **표시만 하는 멍청한 렌더러**로 둔다. 문구는 여기서 완성해 넘긴다 —
 * i18n 은 웹에 있고, 네이티브에 문구를 박으면 앱 업데이트 없이는 못 고친다.
 */

/** Capacitor 플러그인 이름. Android 쪽 `@CapacitorPlugin(name = ...)` 과 일치해야 한다. */
export const TIMER_NOTIFICATION_PLUGIN = 'TimerNotification'

export interface TimerNotificationContent {
  /** 알림 제목. 보통 태그 이름. */
  title: string
  /** 알림 본문. Chronometer 가 시간을 그리므로 여기에 시간을 적지 않는다. */
  text: string
  /**
   * Chronometer 기준시각(epoch ms). OS 가 이 시각으로부터 흐른 시간을 스스로 센다.
   * 앱이 갱신 요청을 보내지 않아도 초가 흐르는 이유가 이 값 하나다.
   */
  whenMs: number
}

interface ShowResult {
  /**
   * 실제로 상태표시줄에 올라갔는지. API 33+ 에서 알림 권한이 없으면 시스템이 조용히
   * 버리는데 **호출 자체는 성공**하므로, 이 값 없이는 성공과 구분할 수 없다.
   */
  shown: boolean
}

interface TimerNotificationPlugin {
  show(content: TimerNotificationContent): Promise<ShowResult>
  hide(): Promise<void>
}

/**
 * 화면이 그리는 값과 알림이 그리는 값을 맞춘다.
 *
 * Chronometer 는 "기준시각으로부터 흐른 시간"만 표현할 수 있는데, 화면이 보여주는 값은
 * `elapsedTimeCal = delta + elapsedTime` 즉 **태그 누적 총합**이다(useTagTimer.ts).
 * 세션 시작 시각을 그대로 넘기면 알림만 이번 세션분을 세서 **화면과 다른 숫자**가 뜬다.
 * 보여주고 싶은 값을 기준시각 쪽으로 옮기는 것이 유일한 수단이다.
 *
 * 두 가지를 방어한다.
 *
 * 1. **미래 시작 시각.** `startedAtMs` 는 서버가 준 값이라 기기 시계가 뒤처지면 미래가
 *    된다. 그대로 넘기면 Chronometer 가 음수를 센다. 웹은 이 경우를 이미 막고 있으므로
 *    (`useTagTimer.ts` 의 `if (delta < 0) return prev`) 알림도 같은 규칙을 따른다.
 * 2. **소수점.** Capacitor 의 `PluginCall.getLong` 은 `instanceof Long` 이 아니면 변환 없이
 *    null 을 준다. 소수가 섞이면 org.json 이 Double 로 파싱해 값이 통째로 사라지고,
 *    알림은 `console.warn` 한 줄만 남긴 채 안 뜬다. 정수로 못박아 그 경로를 없앤다.
 */
export function chronometerBaseMs(session: NativeRunningSession): number {
  const startedAtMs = Math.min(session.startedAtMs, Date.now())
  return Math.round(startedAtMs - session.baseElapsedSec * 1000)
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
 * 실행중 알림을 세운다. 이미 떠 있으면 같은 id 로 덮어써 갱신된다.
 *
 * @returns 표면이 요청대로 수렴했는지 — **실제로 게시됐을 때만** true.
 *   권한 미허용·구 바이너리·웹·호출 실패는 전부 false 다. 호출부는 이 값으로
 *   재수렴 여부를 정한다(원칙 A). 웹에서도 false 라는 점에 주의 — 호출부는 이미
 *   `isNativeApp()` 으로 감싸고 있어야 한다.
 */
export async function showTimerNotification(content: TimerNotificationContent): Promise<boolean> {
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
  if (!isNativeApp() || !hasCapability(TIMER_NOTIFICATION_PLUGIN)) return true

  const cleared = await withPlugin(TIMER_NOTIFICATION_PLUGIN, loadPlugin, async (plugin) => {
    await plugin.hide()
    return true
  })
  return cleared === true
}
