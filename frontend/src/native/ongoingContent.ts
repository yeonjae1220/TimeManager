'use client'

import { readUiLangFromClient, translate, type UiLanguage } from '@/i18n/messages/index'
import type { NativeRunningSession } from './runningSession'

/**
 * 실행중 표시(Android 지속 알림 · iOS Live Activity)의 내용 생성기.
 *
 * 표면과 무관하다 — 어느 쪽이 그리든 같은 문구·같은 기준시각을 받는다. 각자 계산하면
 * 두 표면의 문구가 어긋나도 에러가 없다(TM-ADR-012 C3). 네이티브는 표시만 하는
 * 멍청한 렌더러로 두고, i18n 이 있는 웹에서 문구를 완성해 넘긴다.
 */

export interface OngoingContent {
  /** 제목. 보통 태그 이름. */
  title: string
  /** 본문. OS 가 시간을 따로 그리므로(Chronometer / timerInterval) 여기에 시간을 적지 않는다. */
  text: string
  /**
   * 시간 표시 기준시각(epoch ms). OS 가 이 시각으로부터 흐른 시간을 스스로 센다
   * (Android `setUsesChronometer` / iOS `Text(timerInterval:)`).
   */
  whenMs: number
}

/**
 * 세션의 숫자는 **검증되지 않은 API 응답과 localStorage 스냅샷**에서 온다. 타입에
 * `number` 라고 적혀 있는 것은 선언일 뿐이라 NaN·undefined 가 그대로 흘러든다.
 *
 * 그대로 두면 `Intl.DateTimeFormat.format(new Date(NaN))` 이 RangeError 를 던지는데,
 * 문구 생성은 sync 의 try/catch 밖이라 sync 전체가 reject 하고 — 그걸 await 하는
 * 로그아웃이 세션 정리 전에 멈춘다. 알림 문구 하나가 로그아웃을 막는다.
 *
 * 그래서 경계에서 막는다. 못 쓰는 값은 안전한 기본값으로 강등하되, 조용히 넘어가지
 * 않도록 흔적을 남긴다 — 강등된 알림은 "그럴듯하지만 틀린" 값을 그릴 수 있다.
 */
function finite(value: number, fallback: number, field: string): number {
  if (Number.isFinite(value)) return value
  console.warn(`[ongoingContent] ${field} 가 유한한 수가 아니라 ${fallback} 으로 강등`, value)
  return fallback
}

/**
 * 화면이 그리는 값과 실행중 표시가 그리는 값을 맞춘다.
 *
 * OS 의 시간 표시는 "기준시각으로부터 흐른 시간"만 표현할 수 있는데, 화면이 보여주는
 * 값은 `elapsedTimeCal = delta + elapsedTime` 즉 **태그 누적 총합**이다(useTagTimer.ts).
 * 세션 시작 시각을 그대로 넘기면 표시만 이번 세션분을 세서 **화면과 다른 숫자**가 뜬다.
 * 보여주고 싶은 값을 기준시각 쪽으로 옮기는 것이 유일한 수단이다.
 *
 * 두 가지를 방어한다.
 *
 * 1. **미래 시작 시각.** `startedAtMs` 는 서버가 준 값이라 기기 시계가 뒤처지면 미래가
 *    된다. 그대로 넘기면 시간 표시가 음수를 센다. 웹은 이 경우를 이미 막고 있으므로
 *    (`useTagTimer.ts` 의 `if (delta < 0) return prev`) 표시도 같은 규칙을 따른다.
 * 2. **소수점.** Capacitor 의 `PluginCall.getLong` 은 `instanceof Long` 이 아니면 변환 없이
 *    null 을 준다. 소수가 섞이면 org.json 이 Double 로 파싱해 값이 통째로 사라지고,
 *    알림은 `console.warn` 한 줄만 남긴 채 안 뜬다. 정수로 못박아 그 경로를 없앤다.
 */
export function chronometerBaseMs(session: NativeRunningSession): number {
  const now = Date.now()
  const startedAtMs = Math.min(finite(session.startedAtMs, now, 'startedAtMs'), now)
  return Math.round(startedAtMs - finite(session.baseElapsedSec, 0, 'baseElapsedSec') * 1000)
}

/**
 * 오늘 목표에 도달할 시각(epoch ms). 목표가 없거나 시작 시점에 이미 채웠으면 null.
 *
 * 이 값 하나가 **두 곳**을 먹인다 — 실행중 표시 본문의 "달성 예정 HH:MM" 과 실제로
 * 발화하는 목표 도달 알림(90001)의 예약 시각. 각자 계산하면 어긋나도 아무도 모르고,
 * 사용자는 알림을 받은 뒤에도 상태표시줄에서 다른 시각을 읽게 된다.
 *
 * 기기 시계가 뒤처져 `startedAtMs` 가 미래여도 보정하지 않는다 — 보정하면 본문의
 * 예정 시각만 앞당겨지고 실제 발화는 그대로라, 고치려던 어긋남을 오히려 만든다.
 */
export function goalReachAtMs(session: NativeRunningSession): number | null {
  const goalSec = finite(session.dailyGoalSec, 0, 'dailyGoalSec')
  if (goalSec <= 0) return null

  const remainingSec = goalSec - finite(session.dailyBaseSec, 0, 'dailyBaseSec')
  if (remainingSec <= 0) return null

  return finite(session.startedAtMs, Date.now(), 'startedAtMs') + remainingSec * 1000
}

/**
 * 예정 시각이 이미 지났는지. `goalReachAtMs` 자체는 시간에 무관해야 한다 —
 * 예약(90001)의 발화 시각이 흔들리면 안 되므로, "지났는가" 는 문구 쪽에서만 묻는다.
 */
export function isGoalReached(goalAtMs: number): boolean {
  return goalAtMs <= Date.now()
}

function formatClock(lang: UiLanguage, atMs: number): string {
  return new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(new Date(atMs))
}

/**
 * 세션을 실행중 표시 내용으로. 언어는 화면과 같은 규칙으로 읽는다.
 *
 * ⚠️ 본문은 **게시 시점에 얼어붙는다.** 그 뒤로 움직이는 것은 OS 가 굴리는 시간 표시
 * 숫자뿐이고, 텍스트는 다음 sync 까지 그대로다. 그래서 "오늘 목표의 45%" 같은 진행률을
 * 적으면 안 된다 — 60% 가 된 뒤에도 45% 로 남고, 바로 옆에서 초가 흐르는 만큼 사용자는
 * 그 숫자를 더 확실히 믿는다. 세션이 도는 동안 **변하지 않는 사실**만 적는다.
 *
 * 그래서 남은 시간(계속 줄어듦)이 아니라 도달 **시각**(고정)을 적는다. 단 "예정" 은
 * 그 시각이 지나면 그 자체로 거짓이 되므로, 지났으면 달성으로 바꿔 적는다 —
 * 이미 떠 있는 알림까지 갱신되도록 서명에도 "지났는가" 가 들어간다(runningSession).
 *
 * 자정을 넘기는 예정 시각에 "내일" 을 붙이지 않는다 — dailyResetHour 때문에 이 앱의
 * "오늘" 은 자정에 끝나지 않아서, 붙이는 쪽이 오히려 틀린다.
 */
export function buildOngoingContent(session: NativeRunningSession): OngoingContent {
  const lang = readUiLangFromClient()
  const goalAtMs = goalReachAtMs(session)

  const text = finite(session.dailyGoalSec, 0, 'dailyGoalSec') <= 0
    ? translate(lang, 'notif.ongoing.recording')
    : goalAtMs === null || isGoalReached(goalAtMs)
      ? translate(lang, 'notif.ongoing.goalDone')
      : translate(lang, 'notif.ongoing.goalEta', { time: formatClock(lang, goalAtMs) })

  return {
    title: session.tagName || translate(lang, 'notif.untitledTag'),
    text,
    whenMs: chronometerBaseMs(session),
  }
}
