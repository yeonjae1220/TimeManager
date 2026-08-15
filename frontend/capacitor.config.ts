import type { CapacitorConfig } from '@capacitor/cli'

// Hybrid 방식: 정적 번들을 싣지 않고 배포된 SSR 사이트를 WebView가 직접 로드한다.
// output:'export' 정적화는 layout.tsx가 headers()/cookies()로 CSP nonce·언어를 서버에서
// 결정하는 데 의존해 불가하다. 원격 로드를 택하면 WebView의 origin이 실제 도메인이 되어
// CORS·SameSite 쿠키·CSP가 전부 무수정으로 동작한다.
//
// ⚠️ 오프라인: 이 앱은 serwist precache + idb-keyval + 오프라인 타이머 op 큐로 오프라인을
// 지원한다. Hybrid는 원격 URL을 로드하므로 오프라인 동작이 Service Worker가 WebView에서
// 원격 문서를 가로채 주는지에 달려 있다. Phase 1의 go/no-go 게이트로 실측 검증할 것.
const config: CapacitorConfig = {
  appId: 'com.mungji.timemanager',
  appName: 'TimeManager',
  // Hybrid에서는 실제로 서빙되지 않지만 Capacitor가 존재를 요구한다.
  webDir: 'capacitor-shell',
  server: {
    url: 'https://timemanager.mungji.com',
    cleartext: false,
  },
  ios: {
    // ⚠️ true 필수 — Apple은 WKWebView에서 Service Worker·일부 스토리지 API를
    // App-Bound Domains(Info.plist의 WKAppBoundDomains)로 제한한다. false면 SW가
    // 등록되지 않아 오프라인이 완전히 깨진다(Phase 1 게이트에서 흰 화면으로 실측 확인).
    limitsNavigationsToAppBoundDomains: true,
  },
}

export default config
