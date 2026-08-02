'use client'

import { isNativeApp } from './platform'

/** 딥링크로 되돌아올 OAuth 콜백 경로. Universal/App Links 등록 경로와 반드시 일치해야 한다. */
export const OAUTH_CALLBACK_PATH = '/oauth/callback'

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
 * redirect_uri 는 웹과 동일한 https 주소를 그대로 쓴다. 그래야 Google 콘솔 등록값과 백엔드의
 * 토큰 교환이 무수정으로 유지된다. 콜백은 Universal/App Links가 앱으로 되돌려 주며,
 * NativeShell 의 appUrlOpen 핸들러가 WebView를 콜백 경로로 이동시킨다.
 */
export async function openOAuthUrl(url: string): Promise<void> {
  if (!isNativeApp()) {
    window.location.href = url
    return
  }
  const { Browser } = await import('@capacitor/browser')
  await Browser.open({ url })
}
