'use client'

import { withPlugin } from '@/utils/nativeBridge'
import type { NativeRunningSession } from './runningSession'

/**
 * Android 실행중 표시 — 지속 알림 + Chronometer.
 *
 * Foreground Service 를 쓰지 않는다. `setUsesChronometer(true)` 는 **알림의 기능**이라
 * 서비스와 무관하고, 게시된 알림은 앱 프로세스가 죽어도 재부팅 전까지 살아서 계속 흐른다.
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

interface TimerNotificationPlugin {
  show(content: TimerNotificationContent): Promise<void>
  hide(): Promise<void>
}

/**
 * 화면이 그리는 값과 알림이 그리는 값을 맞춘다.
 *
 * Chronometer 는 "기준시각으로부터 흐른 시간"만 표현할 수 있는데, 화면이 보여주는 값은
 * `elapsedTimeCal = delta + elapsedTime` 즉 **태그 누적 총합**이다(useTagTimer.ts).
 * 세션 시작 시각을 그대로 넘기면 알림만 이번 세션분을 세서 **화면과 다른 숫자**가 뜬다.
 * 보여주고 싶은 값을 기준시각 쪽으로 옮기는 것이 유일한 수단이다.
 */
export function chronometerBaseMs(session: NativeRunningSession): number {
  return session.startedAtMs - session.baseElapsedSec * 1000
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

/** 실행중 알림을 세운다. 이미 떠 있으면 같은 id 로 덮어써 갱신된다. */
export async function showTimerNotification(content: TimerNotificationContent): Promise<void> {
  await withPlugin(TIMER_NOTIFICATION_PLUGIN, loadPlugin, (plugin) => plugin.show(content))
}

/** 실행중 알림을 내린다. 떠 있지 않아도 안전하다(멱등). */
export async function hideTimerNotification(): Promise<void> {
  await withPlugin(TIMER_NOTIFICATION_PLUGIN, loadPlugin, (plugin) => plugin.hide())
}
