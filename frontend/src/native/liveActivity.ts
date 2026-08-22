'use client'

import { hasCapability, withPlugin } from '@/utils/nativeBridge'
import { isNativeApp } from '@/utils/platform'
import type { OngoingContent } from './ongoingContent'

/**
 * iOS 실행중 표시 — Live Activity (Dynamic Island / 잠금화면).
 *
 * 렌더러는 멍청하게 둔다 — 문구는 웹에서 완성해 넘긴다(TM-ADR-012 C2). Swift 쪽
 * `ContentState` 는 `title` / `text` / `whenMs` 세 필드로 `OngoingContent` 와 이름까지
 * 맞춘다 — 브리지는 **이름으로** 디코드하므로 한쪽만 바뀌면 빌드·타입체크 전부
 * 통과한 채 값만 조용히 사라진다(TM-ADR-012 C6).
 *
 * 내용 생성(문구·기준시각)은 표면과 무관하므로 `ongoingContent.ts` 에 있다 — 이 파일은
 * `TimerNotification` 과 같은 형태로 Live Activity 를 부르는 배선만 담당한다.
 */

/** Capacitor 플러그인 이름. Swift 쪽 `jsName` 과 일치해야 한다. */
export const LIVE_ACTIVITY_PLUGIN = 'LiveActivity'

interface ShowResult {
  /**
   * 실제로 액티비티가 시작/갱신됐는지. `shown: false` 가 되는 경로가 셋이다 —
   * iOS 16.2 미만, 사용자가 설정에서 Live Activity 를 껐음, **앱이 백그라운드**
   * (ActivityKit 은 포그라운드에서만 시작 가능). 이 값 없이는 성공과 구분할 수 없다.
   */
  shown: boolean
}

interface LiveActivityPlugin {
  show(content: OngoingContent): Promise<ShowResult>
  hide(): Promise<void>
}

/**
 * `@capacitor/core` 를 정적 import 하지 않는다 — 웹 번들 오염 방지(platform.ts 와 같은 이유).
 * 이 플러그인은 npm 패키지가 아니라 ios/App 프로젝트 안에만 있으므로 `registerPlugin` 으로
 * 프록시를 만든다. 바이너리에 없으면 withPlugin 이 호출 전에 걸러낸다.
 */
async function loadPlugin(): Promise<LiveActivityPlugin> {
  const { registerPlugin } = await import('@capacitor/core')
  return registerPlugin<LiveActivityPlugin>(LIVE_ACTIVITY_PLUGIN)
}

/**
 * 이 기기에서 Live Activity 를 다룰 수 있는지. 플러그인이 ios/App 프로젝트 안에만
 * 있으므로 웹은 물론 **Android 네이티브에서도 false** 다.
 *
 * "다룰 수 없다" 를 "수렴에 실패했다" 와 섞으면 안 된다 — 섞으면 Android 에서 매 sync 마다
 * 서명이 리셋돼 무한 재수렴한다.
 */
export function supportsLiveActivity(): boolean {
  return isNativeApp() && hasCapability(LIVE_ACTIVITY_PLUGIN)
}

/**
 * Live Activity 를 시작하거나 갱신한다. 재시작 후에도 기존 액티비티를 찾아 이어
 * 갱신하는 것은 Swift 쪽 책임이다(TM-ADR-012 C5) — 여기서는 항상 "게시해라" 로만 부른다.
 *
 * @returns 표면이 요청대로 수렴했는지 — **실제로 시작/갱신됐을 때만** true.
 *   iOS 16.2 미만·설정 차단·백그라운드 호출·구 바이너리·웹·호출 실패는 전부 false 다.
 *   호출부는 이 값으로 재수렴 여부를 정한다(원칙 A).
 */
export async function showLiveActivity(content: OngoingContent): Promise<boolean> {
  const result = await withPlugin(LIVE_ACTIVITY_PLUGIN, loadPlugin, (plugin) =>
    plugin.show(content),
  )
  return result?.shown === true
}

/**
 * Live Activity 를 종료한다. 떠 있지 않아도 안전하다(멱등).
 *
 * @returns 액티비티가 확실히 없는지. 웹·구 바이너리·Android 는 **띄운 적이 없으므로**
 *   true — 여기서 false 를 주면 호출부가 영원히 재시도한다. 네이티브 호출이 실패했을
 *   때만 false 이며, 그때는 유령 액티비티가 남아 있을 수 있다.
 */
export async function hideLiveActivity(): Promise<boolean> {
  if (!supportsLiveActivity()) return true

  const cleared = await withPlugin(LIVE_ACTIVITY_PLUGIN, loadPlugin, async (plugin) => {
    await plugin.hide()
    return true
  })
  return cleared === true
}
