//
//  MainViewController.swift
//  App
//
//  TM-ADR-012 C5 — 앱 타깃에 직접 넣은 커스텀 Swift 플러그인은 Capacitor 6+ 에서
//  ObjC 런타임 자동 발견 대상이 아니다(npm 패키지·SPM 플러그인만 자동 발견됨).
//  CAPBridgeViewController 를 서브클래싱해 capacitorDidLoad() 에서 명시적으로
//  등록해야 window.Capacitor.Plugins.LiveActivity 가 채워진다.
//
//  이 앱은 Main.storyboard 를 실제로 쓰지 않는다 — SceneDelegate.swift 가
//  `window?.rootViewController = ...` 로 직접 인스턴스를 만든다. 거기서
//  CAPBridgeViewController() 대신 이 클래스를 생성해야 적용된다.
//

import Capacitor

class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LiveActivityPlugin())
    }
}
