//
//  AppleSignInPlugin.swift
//  App
//
//  Sign in with Apple(App Store 가이드라인 4.8) — iOS 네이티브 시트로 identity token 을 받는다.
//  TS 쪽은 src/native/appleSignIn.ts.
//
//  nonce: TS 가 원문을 만들어 넘기고, 여기서 SHA-256(hex) 해 Apple 에 건넨다. Apple 은 그 해시를
//  토큰의 nonce 클레임에 그대로 싣고, 백엔드(AppleIdentityTokenAdapter)는 원문을 받아 같은 해시로
//  비교한다. 원문은 이 프로세스 밖으로 나가지 않는다(Apple 에도 해시만 간다).
//
//  사용자 취소는 reject 가 아니라 { cancelled: true } 로 돌려준다 — 웹이 에러 문구를 띄우지 않게.
//

import AuthenticationServices
import Capacitor
import CryptoKit
import Foundation

@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate,
                                ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "AppleSignInPlugin"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)
    ]

    /// 진행 중인 요청. 시트는 한 번에 하나만 뜬다 — 두 번째 호출은 거부한다.
    private var pendingCall: CAPPluginCall?

    @objc public func signIn(_ call: CAPPluginCall) {
        guard let rawNonce = call.getString("nonce"), !rawNonce.isEmpty else {
            call.reject("nonce required")
            return
        }
        guard pendingCall == nil else {
            call.reject("sign in already in progress")
            return
        }
        pendingCall = call

        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = Self.sha256Hex(rawNonce)

        DispatchQueue.main.async {
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        bridge?.webView?.window ?? ASPresentationAnchor()
    }

    public func authorizationController(controller: ASAuthorizationController,
                                        didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = takePendingCall() else { return }
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let identityToken = String(data: tokenData, encoding: .utf8) else {
            call.reject("missing identity token")
            return
        }
        // 이름은 최초 승인 때만 온다. 이후엔 nil 이라 빈 문자열로 둔다.
        let fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
            .compactMap { $0 }
            .joined(separator: " ")
        // authorizationCode 는 계정 삭제 시 Apple 토큰 철회(가이드라인 5.1.1(v))에 필요하다.
        // 앱 바이너리는 웹보다 훨씬 드물게 나가므로, 백엔드가 쓰기 전부터 미리 넘긴다.
        let authorizationCode = credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) } ?? ""
        call.resolve([
            "cancelled": false,
            "identityToken": identityToken,
            "authorizationCode": authorizationCode,
            "fullName": fullName
        ])
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = takePendingCall() else { return }
        if let authError = error as? ASAuthorizationError, authError.code == .canceled {
            call.resolve(["cancelled": true])
            return
        }
        call.reject("apple sign in failed", nil, error)
    }

    private func takePendingCall() -> CAPPluginCall? {
        defer { pendingCall = nil }
        return pendingCall
    }

    private static func sha256Hex(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
