'use client'

import { isNativeApp } from './platform'

/** 딥링크로 되돌아올 OAuth 콜백 경로. Universal/App Links 등록 경로와 반드시 일치해야 한다. */
export const OAUTH_CALLBACK_PATH = '/oauth/callback'

/**
 * 커스텀 URL 스킴 — Universal/App Links 가 콜백을 앱으로 못 되돌릴 때의 폴백.
 *
 * iOS Universal Links 는 associated-domains 권한(=유료 Apple Developer 계정)이 있어야
 * 프로비저닝에 들어가고, Android App Links 는 assetlinks.json 에 그 빌드의 서명 지문이
 * 등록돼 있어야 autoVerify 를 통과한다. 둘 중 하나라도 안 맞으면 콜백이 시스템 브라우저에
 * 그대로 남고, 로그인은 브라우저 쪽에서 끝나 앱은 로그아웃 상태로 남는다
 * (WebView 와 브라우저는 쿠키 저장소가 분리돼 있다).
 *
 * ⚠️ 커스텀 스킴은 도메인·서명으로 검증되지 않는다 — 같은 스킴을 등록한 다른 앱이 있으면
 * 콜백을 가로챌 수 있다. 그래서 ①RFC 8252 §7.1 권고대로 역DNS(번들 ID) 스킴을 쓰고
 * ②Universal/App Links 가 잡히면 이 경로는 아예 안 탄다(브라우저가 페이지를 렌더링조차
 * 하지 않으므로 아래 폴백 코드가 실행될 기회가 없다). 유료 계정으로 Universal Links 를
 * 켜더라도 이 폴백은 지우지 말 것 — 검증 실패/미검증 창(설치 직후 등)의 안전망이다.
 */
export const NATIVE_OAUTH_SCHEME = 'com.mungji.timemanager'
export const NATIVE_OAUTH_CALLBACK_HOST = 'oauth'
const NATIVE_OAUTH_CALLBACK_PATH = '/callback'

/** 콜백 페이지가 앱으로 되돌아갈 때 쓰는 딥링크. Google 에는 등록하지 않는다(내부 릴레이 전용). */
export const NATIVE_OAUTH_CALLBACK_URL =
  `${NATIVE_OAUTH_SCHEME}://${NATIVE_OAUTH_CALLBACK_HOST}${NATIVE_OAUTH_CALLBACK_PATH}`

/**
 * "이 플로우는 앱에서 시작됐다"는 표식. Google 이 state 를 그대로 돌려주므로,
 * 시스템 브라우저에 남은 콜백 페이지가 자기가 릴레이해야 하는지 이걸로 판별한다.
 * (브라우저 쪽에는 state 쿠키가 없어 검증 자체가 불가능하다 — 판단 근거가 state 문자열뿐이다.)
 */
const NATIVE_STATE_PREFIX = 'native-'

/** CSRF state 생성. 네이티브에서 시작한 플로우면 릴레이 표식을 붙인다. */
export function createOauthState(): string {
  return `${isNativeApp() ? NATIVE_STATE_PREFIX : ''}${crypto.randomUUID()}`
}

/** 돌아온 state 가 네이티브에서 시작된 플로우의 것인지. */
export function isNativeOauthState(state: string | null | undefined): boolean {
  return typeof state === 'string' && state.startsWith(NATIVE_STATE_PREFIX)
}

/** 브라우저에 남은 콜백을 앱으로 넘길 딥링크. `search` 는 `?code=...&state=...` 원문 그대로. */
export function buildNativeCallbackUrl(search: string): string {
  return `${NATIVE_OAUTH_CALLBACK_URL}${search}`
}

/**
 * 앱이 받은 딥링크를 WebView 가 이동할 경로로 바꾼다. 처리 대상이 아니면 null.
 *
 * 두 경로를 같은 규칙으로 받는다:
 *  ① `https://<우리도메인>/oauth/callback?...`  — Universal/App Links (검증되면 이쪽이 우선)
 *  ② `com.mungji.timemanager://oauth/callback?...` — 커스텀 스킴 폴백
 *
 * 순수 함수로 둔 이유: 실기기에서만 도는 경로라 단위 테스트가 닿는 곳이 여기뿐이다.
 */
export function resolveOauthCallbackTarget(rawUrl: string, webOrigin: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return null
  }

  if (parsed.protocol === `${NATIVE_OAUTH_SCHEME}:`) {
    if (parsed.host !== NATIVE_OAUTH_CALLBACK_HOST) return null
    if (!parsed.pathname.startsWith(NATIVE_OAUTH_CALLBACK_PATH)) return null
    // 커스텀 스킴에는 오리진이 없다 — WebView 의 콜백 경로로 정규화해 넘긴다.
    return `${OAUTH_CALLBACK_PATH}${parsed.search}`
  }

  if (parsed.origin !== webOrigin) return null
  if (!parsed.pathname.startsWith(OAUTH_CALLBACK_PATH)) return null
  return `${parsed.pathname}${parsed.search}`
}

/**
 * Google 인증 URL을 연다.
 *
 * - 웹: 현재 탭에서 이동(기존 동작 그대로).
 * - 네이티브: 시스템 브라우저(iOS SFSafariViewController / Android Custom Tabs)로 연다.
 *   WebView 안에서 열면 안 되는 이유가 둘이다.
 *     ① Google이 WebView User-Agent의 OAuth를 차단한다(disallowed_useragent).
 *     ② App-Bound Domains를 켜면(Service Worker·오프라인에 필요) WebView가 외부 도메인으로
 *        아예 이동하지 못해, 자동 externalize에 기대면 엉뚱한 URL이 열린다(실측 확인).
 *
 * redirect_uri 는 웹과 동일한 https 주소를 그대로 쓴다 — 커스텀 스킴은 Google 에 넘기지
 * 않는다. 그래야 Google 콘솔 등록값과 백엔드 토큰 교환이 무수정으로 유지된다.
 * 앱으로 되돌리는 건 그 뒤의 내부 릴레이(Universal/App Links 또는 커스텀 스킴)가 맡는다.
 */
export async function openOAuthUrl(url: string): Promise<void> {
  if (!isNativeApp()) {
    window.location.href = url
    return
  }
  const { Browser } = await import('@capacitor/browser')
  await Browser.open({ url })
}
