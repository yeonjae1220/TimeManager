'use client'

import { isNativeApp } from './platform'

/**
 * 네이티브 플러그인 호출의 단일 관문.
 *
 * 이 앱은 원격 로드 하이브리드다(capacitor.config.ts 의 server.url 이 배포 사이트를 직접 띄운다).
 * 그래서 웹은 매일 배포되는데 사용자 기기의 앱 바이너리는 몇 주에 한 번 바뀐다 — 새 웹 코드가
 * 구 바이너리에 없는 플러그인을 부르면 "plugin is not implemented" 로 예외가 난다.
 *
 * withPlugin 은 그 스큐를 흡수한다:
 *   1) 네이티브가 아니면 no-op (웹/PWA)
 *   2) 바이너리에 플러그인이 없으면 no-op (구 버전 사용자)
 *   3) 호출 자체가 실패해도 예외를 밖으로 던지지 않는다 — 알림 실패가 타이머 조작을 깨면 안 된다
 *
 * @capacitor/core 를 정적 import 하지 않는 것은 platform.ts 와 같은 이유다(웹 번들 오염 방지).
 * 플러그인 모듈은 loader 안에서 동적 import 하므로 웹에서는 요청조차 되지 않는다.
 */

/** 같은 capability 에 대한 경고를 앱 수명당 한 번만 남기기 위한 표식. */
const warnedCapabilities = new Set<string>()

function warnOnce(cap: string, message: string): void {
  if (warnedCapabilities.has(cap)) return
  warnedCapabilities.add(cap)
  console.warn(`[nativeBridge] ${message}`)
}

/** 설치된 바이너리가 이 플러그인을 제공하는지. 웹에서는 항상 false. */
export function hasCapability(cap: string): boolean {
  if (typeof window === 'undefined') return false
  return window.Capacitor?.isPluginAvailable?.(cap) === true
}

/**
 * 플러그인을 안전하게 호출한다. 호출이 성립하지 않거나 실패하면 undefined 를 돌려준다.
 *
 * @param cap    Capacitor 플러그인 이름 (예: 'LocalNotifications')
 * @param loader 플러그인 모듈 동적 import
 * @param fn     모듈을 받아 실제 호출을 수행하는 함수
 */
export async function withPlugin<TModule, TResult>(
  cap: string,
  loader: () => Promise<TModule>,
  fn: (plugin: TModule) => TResult | Promise<TResult>,
): Promise<TResult | undefined> {
  if (!isNativeApp()) return undefined

  if (!hasCapability(cap)) {
    // 실패가 아니라 "이 바이너리는 아직 이 기능이 없다" 는 정상 상태다.
    // 다만 원인 추적 수단은 남긴다 — 조용히 사라지면 기능 미동작을 추적할 수 없다.
    warnOnce(cap, `${cap} 플러그인이 이 앱 바이너리에 없어 건너뜀 (앱 업데이트 필요)`)
    return undefined
  }

  try {
    return await fn(await loader())
  } catch (error) {
    console.warn(`[nativeBridge] ${cap} 호출 실패`, error)
    return undefined
  }
}

/** 테스트 전용 — warnOnce 표식 초기화. */
export function __resetNativeBridgeWarnings(): void {
  warnedCapabilities.clear()
}
