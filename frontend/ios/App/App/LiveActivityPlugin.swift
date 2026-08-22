//
//  LiveActivityPlugin.swift
//  App
//
//  TM-ADR-012 C5 — TS liveActivity.ts 의 LiveActivity 플러그인 구현.
//
//  Android TimerNotificationPlugin 과 대칭 계약이다: 렌더러(TimerLiveActivityLiveActivity)는
//  멍청하게 두고, 문구는 TS(ongoingContent.ts)가 완성해 넘긴 대로 그대로 찍는다.
//  `show()` 는 항상 { shown: Bool } 계약을 지킨다 — 실패 경로가 셋이라(iOS 16.2 미만,
//  사용자가 설정에서 Live Activity 를 꺼둠, **앱이 백그라운드**) 이 값 없이는 성공과
//  구분할 수 없다.
//

import ActivityKit
import Capacitor
import Foundation

@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise)
    ]

    @objc public func show(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["shown": false])
            return
        }
        guard let title = call.getString("title"), let text = call.getString("text") else {
            call.reject("title/text required")
            return
        }
        let whenMs = call.getDouble("whenMs", 0)
        let state = TimerActivityAttributes.ContentState(title: title, text: text, whenMs: whenMs)
        // staleDate = 시작 + 8시간(TM-ADR-009). 그 뒤로는 OS 가 흐릿하게 렌더해
        // "이 값은 오래됐다"를 알린다 — 다른 기기에서 정지한 경우의 완화책.
        let content = ActivityContent(state: state, staleDate: Date().addingTimeInterval(8 * 60 * 60))

        Task {
            // 재시작 후 재부착. 플러그인이 인메모리 참조를 잃어도 기존 액티비티를
            // 찾아 update() 한다 — 안 하면 앱 재시작마다 액티비티가 하나씩 늘어난다.
            if let existing = Activity<TimerActivityAttributes>.activities.first {
                await existing.update(content)
                call.resolve(["shown": true])
                return
            }

            guard ActivityAuthorizationInfo().areActivitiesEnabled else {
                call.resolve(["shown": false])
                return
            }

            do {
                _ = try Activity<TimerActivityAttributes>.request(
                    attributes: TimerActivityAttributes(),
                    content: content
                )
                call.resolve(["shown": true])
            } catch {
                // ActivityKit 은 포그라운드에서만 시작할 수 있다 — 백그라운드 호출은
                // 여기서 throw 한다. shown:false 로 옮겨 담으면, 표면별 서명 리셋
                // 구조(runningSession.ts)가 새 코드 0줄로 다음 sync(대개 포그라운드
                // 복귀) 재시도를 흡수한다.
                call.resolve(["shown": false])
            }
        }
    }

    @objc public func hide(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve()
            return
        }
        Task {
            // 단건 조회가 아니라 전체 순회 — 결함으로 다중 생성됐을 때 하나만
            // 지우면 유령이 영구히 남는다.
            for activity in Activity<TimerActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            call.resolve()
        }
    }
}
