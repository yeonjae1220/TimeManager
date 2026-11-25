'use client'

import { hasCapability, withPlugin } from '@/utils/nativeBridge'
import { isNativeApp } from '@/utils/platform'

/**
 * Sign in with Apple — iOS 네이티브 시트(ios/App/App/AppleSignInPlugin.swift).
 *
 * App Store 가이드라인 4.8 때문에 **iOS 앱에만** 노출한다. 웹·Android 에는 버튼이 없다.
 * 플러그인이 ios/App 프로젝트 안에만 있으므로 Android·웹·구 바이너리에서 `supportsAppleSignIn()` 은 false.
 */

/** Capacitor 플러그인 이름. Swift 쪽 `jsName` 과 일치해야 한다(nativeContract.test.ts 가 강제). */
export const APPLE_SIGN_IN_PLUGIN = 'AppleSignIn'

interface NativeResult {
  cancelled: boolean
  identityToken?: string
  /** 계정 삭제 시 Apple 토큰 철회용. 5분 안에 서버가 교환해야 한다. */
  authorizationCode?: string
  fullName?: string
}

interface AppleSignInPlugin {
  signIn(options: { nonce: string }): Promise<NativeResult>
}

export type AppleSignInOutcome =
  | { kind: 'success'; identityToken: string; authorizationCode: string; nonce: string; fullName: string }
  | { kind: 'cancelled' }
  | { kind: 'failed' }

let pluginRef: Promise<{ plugin: AppleSignInPlugin }> | null = null

/**
 * 🔴 프록시를 객체로 감싸 돌려준다 — liveActivity.ts 와 같은 이유(GLOBAL-PIT-136).
 * async 로 두지 않는다.
 */
function loadPlugin(): Promise<{ plugin: AppleSignInPlugin }> {
  pluginRef ??= import('@capacitor/core').then(({ registerPlugin }) => ({
    plugin: registerPlugin<AppleSignInPlugin>(APPLE_SIGN_IN_PLUGIN),
  }))
  return pluginRef
}

/** 테스트 전용 */
export function __resetAppleSignInPlugin(): void {
  pluginRef = null
}

export function supportsAppleSignIn(): boolean {
  return isNativeApp() && hasCapability(APPLE_SIGN_IN_PLUGIN)
}

/** 백엔드가 SHA-256 해 토큰의 nonce 클레임과 비교하는 원문. 요청마다 새로 만든다. */
function createNonce(): string {
  return crypto.randomUUID()
}

/**
 * Apple 시트를 띄워 identity token 을 받는다. 백엔드 교환은 호출부(useAuth)가 한다.
 * 실패를 빈 값으로 숨기지 않는다 — 취소와 실패를 구분해 돌려준다.
 */
export async function signInWithApple(): Promise<AppleSignInOutcome> {
  const nonce = createNonce()
  const result = await withPlugin(APPLE_SIGN_IN_PLUGIN, loadPlugin, ({ plugin }) =>
    plugin.signIn({ nonce }),
  )
  if (result === undefined) return { kind: 'failed' }
  if (result.cancelled) return { kind: 'cancelled' }
  if (!result.identityToken) return { kind: 'failed' }
  return {
    kind: 'success',
    identityToken: result.identityToken,
    authorizationCode: result.authorizationCode ?? '',
    nonce,
    fullName: result.fullName ?? '',
  }
}
