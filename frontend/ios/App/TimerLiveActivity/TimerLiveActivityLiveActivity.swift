//
//  TimerLiveActivityLiveActivity.swift
//  TimerLiveActivity
//
//  TM-ADR-012 C2/C5 — 잠금화면·Dynamic Island 렌더러.
//
//  렌더러는 멍청하게 둔다: title/text 는 ContentState 에 담겨 온 그대로 찍고, 시간은
//  timerInterval 로 OS 가 스스로 센다(원격 갱신 없이 초가 흐르는 이유). 진행률·남은
//  시간 같은 "시간에 따라 계속 변하는" 값은 절대 정적으로 넣지 않는다 —
//  옆에서 timerInterval 이 실시간으로 흐르는 만큼 사용자는 얼어붙은 숫자를 더
//  확실히 믿는다(pit-134).
//
//  Dynamic Island 축소형(compact/minimal)은 아이콘+타이머만 쓴다 — 공간이 좁아
//  문구를 넣을 자리가 없고, ADR 이 새 i18n 키를 추가하지 않기로 한 이유이기도 하다.
//

import ActivityKit
import WidgetKit
import SwiftUI

private func timerBase(_ state: TimerActivityAttributes.ContentState) -> Date {
    Date(timeIntervalSince1970: state.whenMs / 1000)
}

/// 끝 경계는 형식상 필요할 뿐이라 멀리 둔다. 12시간 넘게 도는 세션은 리마인더가
/// 이미 다룬다(runningSession.ts LONG_RUN_REMINDERS).
private let farFuture = Date.now.addingTimeInterval(60 * 60 * 24 * 30)

struct TimerLiveActivityLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TimerActivityAttributes.self) { context in
            LockScreenView(state: context.state)
                .activityBackgroundTint(Color.black.opacity(0.8))
                .activitySystemActionForegroundColor(Color.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "timer")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: timerBase(context.state)...farFuture, countsDown: false)
                        .monospacedDigit()
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.state.title)
                            .font(.headline)
                        Text(context.state.text)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            } compactLeading: {
                Image(systemName: "timer")
            } compactTrailing: {
                Text(timerInterval: timerBase(context.state)...farFuture, countsDown: false)
                    .monospacedDigit()
                    .frame(width: 44)
            } minimal: {
                Image(systemName: "timer")
            }
        }
    }
}

private struct LockScreenView: View {
    let state: TimerActivityAttributes.ContentState

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(state.title)
                    .font(.headline)
                Text(state.text)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(timerInterval: timerBase(state)...farFuture, countsDown: false)
                .monospacedDigit()
                .font(.title2)
        }
        .padding()
    }
}
