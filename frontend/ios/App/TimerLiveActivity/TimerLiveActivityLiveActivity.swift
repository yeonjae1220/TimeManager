//
//  TimerLiveActivityLiveActivity.swift
//  TimerLiveActivity
//
//  TM-ADR-012 C2/C5 — 잠금화면·Dynamic Island·워치 스마트 스택 렌더러.
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
//  ── 워치(Apple Watch 스마트 스택) ─────────────────────────────────────────
//  watchOS 11 / iOS 18 부터 아이폰의 Live Activity 가 페어링된 워치의 스마트 스택에
//  실린다. **워치용 별도 타깃은 필요 없다** — 이 확장의 SwiftUI 를 시스템이 워치로
//  넘겨 그린다. 다만 `supplementalActivityFamilies([.small])` 를 선언하지 않으면
//  시스템 기본 표현(compactLeading/compactTrailing + 앱 이름)만 나와서, 시간은
//  흐르는데 **어떤 태그가 도는지가 안 보인다**. 그래서 .small 전용 뷰를 따로 준다.
//
//  ⚠️ 그 API 는 iOS 18+ 인데 이 확장의 배포 타깃은 16.2 라, Widget 을 버전별로 둘로
//  나눠 WidgetBundle 에서 고른다(TimerLiveActivityBundle.swift). 화면에 나오는 것은
//  전부 아래 공용 뷰 한 벌에서 나오고 두 Widget 은 설정 껍데기만 다르다 — 한쪽만
//  고쳐지고 다른 쪽이 조용히 남는 사고를 막기 위해서다(GLOBAL-PIT-132).
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

// MARK: - 공용 조각
// 표면(잠금화면·Dynamic Island·워치)마다 배치만 다르고 내용은 전부 여기서 나온다.
// 글꼴·크기는 호출부가 정한다 — 표면마다 여백이 달라서다.

private struct TimerIcon: View {
    var body: some View {
        Image(systemName: "timer")
    }
}

/// OS 가 스스로 세는 경과 시간. 정적 문자열로 만들지 말 것(위 pit-134 설명 참조).
private struct RunningTime: View {
    let state: TimerActivityAttributes.ContentState

    var body: some View {
        Text(timerInterval: timerBase(state)...farFuture, countsDown: false)
            .monospacedDigit()
    }
}

private struct TitleAndText: View {
    let state: TimerActivityAttributes.ContentState
    let spacing: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: spacing) {
            Text(state.title)
                .font(.headline)
            Text(state.text)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
}

// MARK: - 표면별 뷰

private extension View {
    /// 잠금화면 표면의 공통 배색 — 배경 틴트 **와 전경색 체계**를 함께 정한다.
    /// 구버전 위젯과 iOS 18 의 .medium 분기 양쪽에서 써야 해서 한 벌로 뺀다 —
    /// 한쪽만 고쳐지면 두 OS 에서 잠금화면 색이 갈린다.
    ///
    /// ⚠️ colorScheme 을 명시적으로 못박는 것이 핵심이다. 배경은 activityBackgroundTint 로
    /// 어둡게 **강제**해놓고 글자색은 `.primary`(시스템이 정함)에 맡기면 둘이 어긋난다 —
    /// iOS 17.5 실측에서 어두운 카드 위에 제목·타이머가 검게 렌더돼 사실상 안 읽혔다
    /// (같은 코드가 iOS 18.4 잠금화면과 iOS 17.5 Dynamic Island 에서는 흰색이었다).
    /// activitySystemActionForegroundColor 는 시스템 액션 버튼 색이라 본문에 영향이 없다.
    /// 배경을 우리가 정했으면 전경도 우리가 정해야 한다.
    func lockScreenActivityStyle() -> some View {
        self
            .environment(\.colorScheme, .dark)
            .activityBackgroundTint(Color.black.opacity(0.8))
            .activitySystemActionForegroundColor(Color.white)
    }
}

/// iOS 잠금화면(.medium). 워치 지원을 켜도 이 배치는 그대로다 — 아이폰 표시를
/// 바꾸는 변경이 아니다.
private struct LockScreenView: View {
    let state: TimerActivityAttributes.ContentState

    var body: some View {
        HStack {
            TitleAndText(state: state, spacing: 4)
            Spacer()
            RunningTime(state: state)
                .font(.title2)
        }
        .padding()
    }
}

/// Apple Watch 스마트 스택(.small).
///
/// `text`(부연 문구)는 일부러 뺐다 — 워치는 흘끗 보는 표면이라 문장을 읽게 만들면
/// 안 된다는 게 Apple 의 .small 지침이다. 여기서 답해야 하는 질문은 "무엇이 지금
/// 도는가(title)"와 "얼마나 됐나(타이머)" 둘뿐이다.
///
/// 잠금화면과 달리 배경 틴트를 주지 않는다 — 스마트 스택 카드가 자기 배경을
/// 갖고 있어서, 덧칠하면 다른 카드들 사이에서 혼자 튄다.
@available(iOS 18.0, *)
private struct SmartStackView: View {
    let state: TimerActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 8) {
            TimerIcon()
                .font(.title3)
                .foregroundStyle(.tint)

            VStack(alignment: .leading, spacing: 0) {
                Text(state.title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                RunningTime(state: state)
                    .font(.title3)
            }

            Spacer(minLength: 0)
        }
    }
}

/// 같은 액티비티가 아이폰 잠금화면과 워치 스마트 스택 양쪽에 실리므로, 어느 표면에
/// 그려지는지를 보고 배치를 고른다.
@available(iOS 18.0, *)
private struct AdaptiveContentView: View {
    @Environment(\.activityFamily) private var activityFamily
    let state: TimerActivityAttributes.ContentState

    var body: some View {
        switch activityFamily {
        case .small:
            SmartStackView(state: state)
        default:
            // .medium(잠금화면)과 앞으로 늘어날 family. 좁은 표면은 .small 하나뿐이라
            // 넓은 쪽을 기본값으로 두는 게 안전하다.
            LockScreenView(state: state)
                .lockScreenActivityStyle()
        }
    }
}

// MARK: - 설정

/// 잠금화면 내용만 갈아끼울 수 있게 열어둔 공용 설정. Dynamic Island 는 iOS 전용이라
/// 버전과 무관하게 같으므로 여기 한 벌만 둔다.
private func timerActivityConfiguration<Content: View>(
    @ViewBuilder content: @escaping (TimerActivityAttributes.ContentState) -> Content
) -> some WidgetConfiguration {
    ActivityConfiguration(for: TimerActivityAttributes.self) { context in
        content(context.state)
    } dynamicIsland: { context in
        DynamicIsland {
            DynamicIslandExpandedRegion(.leading) {
                TimerIcon()
            }
            DynamicIslandExpandedRegion(.trailing) {
                RunningTime(state: context.state)
            }
            DynamicIslandExpandedRegion(.bottom) {
                TitleAndText(state: context.state, spacing: 2)
            }
        } compactLeading: {
            TimerIcon()
        } compactTrailing: {
            // 고정 폭이 아니라 하한이다. 44pt 는 `MM:SS`(5자) 기준이라, 한 시간을 넘겨
            // `H:MM:SS`(7자)가 되는 순간 `2:0…` 로 잘린다(실측). 이 앱은 12시간+ 세션을
            // 명시적으로 지원하므로(runningSession.ts LONG_RUN_REMINDERS) 드문 일이 아니다.
            // 하한을 남기는 이유는 짧은 값에서 섬이 매초 들썩이지 않게 하기 위해서다.
            RunningTime(state: context.state)
                .frame(minWidth: 44)
        } minimal: {
            TimerIcon()
        }
    }
}

/// iOS 16.2–17. 워치에서는 시스템 기본 표현(아이콘+시간+앱 이름)으로 나온다.
struct TimerLiveActivityLiveActivity: Widget {
    var body: some WidgetConfiguration {
        timerActivityConfiguration { state in
            LockScreenView(state: state)
                .lockScreenActivityStyle()
        }
    }
}

/// iOS 18+. 위와 같은 설정에 워치 스마트 스택 지원만 더한 것이다.
@available(iOS 18.0, *)
struct TimerLiveActivitySmartStack: Widget {
    var body: some WidgetConfiguration {
        timerActivityConfiguration { state in
            AdaptiveContentView(state: state)
        }
        .supplementalActivityFamilies([.small])
    }
}
