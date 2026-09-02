import { afterEach, describe, expect, it } from 'vitest'

import {
  NATIVE_OAUTH_SCHEME,
  buildNativeCallbackUrl,
  createOauthState,
  isNativeOauthState,
  resolveOauthCallbackTarget,
} from './nativeOAuth'

const WEB_ORIGIN = 'https://timemanager.mungji.com'

function setNative(native: boolean) {
  if (!native) {
    delete (window as { Capacitor?: unknown }).Capacitor
    return
  }
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' }
}

afterEach(() => setNative(false))

describe('createOauthState / isNativeOauthState', () => {
  it('웹에서 만든 state 에는 릴레이 표식이 없다', () => {
    setNative(false)
    expect(isNativeOauthState(createOauthState())).toBe(false)
  })

  it('네이티브에서 만든 state 는 릴레이 대상으로 판별된다', () => {
    setNative(true)
    expect(isNativeOauthState(createOauthState())).toBe(true)
  })

  it('state 가 없거나 표식이 없으면 릴레이하지 않는다', () => {
    expect(isNativeOauthState(null)).toBe(false)
    expect(isNativeOauthState(undefined)).toBe(false)
    expect(isNativeOauthState('')).toBe(false)
    expect(isNativeOauthState('9f1c-plain-uuid')).toBe(false)
  })

  it('표식을 붙여도 매번 다른 값이다 — CSRF 난수성이 유지된다', () => {
    setNative(true)
    expect(createOauthState()).not.toBe(createOauthState())
  })
})

describe('resolveOauthCallbackTarget', () => {
  it('Universal/App Links 의 https 콜백을 그대로 받는다', () => {
    expect(resolveOauthCallbackTarget(`${WEB_ORIGIN}/oauth/callback?code=a&state=b`, WEB_ORIGIN))
      .toBe('/oauth/callback?code=a&state=b')
  })

  it('커스텀 스킴 콜백을 WebView 경로로 정규화한다', () => {
    expect(resolveOauthCallbackTarget(`${NATIVE_OAUTH_SCHEME}://oauth/callback?code=a&state=native-b`, WEB_ORIGIN))
      .toBe('/oauth/callback?code=a&state=native-b')
  })

  it('쿼리가 없어도 콜백 경로로 넘긴다', () => {
    expect(resolveOauthCallbackTarget(`${NATIVE_OAUTH_SCHEME}://oauth/callback`, WEB_ORIGIN))
      .toBe('/oauth/callback')
  })

  it('다른 오리진의 https 링크는 처리하지 않는다 — 열린 리다이렉트가 된다', () => {
    expect(resolveOauthCallbackTarget('https://evil.example/oauth/callback?code=a', WEB_ORIGIN)).toBeNull()
  })

  it('우리 도메인이라도 콜백 경로가 아니면 처리하지 않는다', () => {
    expect(resolveOauthCallbackTarget(`${WEB_ORIGIN}/settings`, WEB_ORIGIN)).toBeNull()
  })

  it('우리 스킴이라도 콜백 호스트/경로가 아니면 처리하지 않는다', () => {
    expect(resolveOauthCallbackTarget(`${NATIVE_OAUTH_SCHEME}://other/callback?code=a`, WEB_ORIGIN)).toBeNull()
    expect(resolveOauthCallbackTarget(`${NATIVE_OAUTH_SCHEME}://oauth/elsewhere?code=a`, WEB_ORIGIN)).toBeNull()
  })

  it('다른 앱의 스킴은 처리하지 않는다', () => {
    expect(resolveOauthCallbackTarget('other.app://oauth/callback?code=a', WEB_ORIGIN)).toBeNull()
  })

  it('URL 이 아니면 던지지 않고 null 을 돌려준다', () => {
    expect(resolveOauthCallbackTarget('not a url', WEB_ORIGIN)).toBeNull()
    expect(resolveOauthCallbackTarget('', WEB_ORIGIN)).toBeNull()
  })
})

describe('buildNativeCallbackUrl', () => {
  it('브라우저에 남은 콜백의 쿼리를 그대로 딥링크로 옮긴다', () => {
    const search = '?code=4/0Ab&state=native-9f1c&scope=openid+email'
    const deepLink = buildNativeCallbackUrl(search)

    expect(deepLink.startsWith(`${NATIVE_OAUTH_SCHEME}://oauth/callback`)).toBe(true)
    // 왕복 후 원래 쿼리가 손실 없이 복원돼야 한다.
    expect(resolveOauthCallbackTarget(deepLink, WEB_ORIGIN)).toBe(`/oauth/callback${search}`)
  })
})
