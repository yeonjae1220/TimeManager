//
//  TimerActivityAttributes.swift
//  App / TimerLiveActivity (양쪽 타깃 멤버십)
//
//  TM-ADR-012 C2 — Live Activity 의 ContentState 계약.
//
//  렌더러는 멍청하게 둔다: 문구·시각 계산은 전부 웹(TS, ongoingContent.ts)에서 끝내 넘긴다.
//  정적 속성(Attributes 최상위)은 두지 않는다 — 액티비티 수명 동안 바꿀 수 없어서, 여기에
//  태그명 등을 두면 실행 중 값이 바뀌어도 반영되지 않는데 그건 실패가 아니라 "정상으로
//  보이는 어긋남"이라 아무도 눈치채지 못한다. 바뀔 수 있는 값은 전부 ContentState 에 둔다.
//
//  ⚠️ 진행률·남은 시간처럼 시간에 따라 계속 변하는 값을 여기 넣지 않는다 — Live Activity 는
//  갱신하지 않는 한 게시 시점 값에 얼어붙는데, 옆에서 timerInterval 이 실시간으로 흐르는
//  만큼 사용자는 얼어붙은 숫자를 더 확실히 믿는다.
//

import ActivityKit
import Foundation

@available(iOS 16.2, *)
struct TimerActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// 제목 — 웹이 이미 폴백까지 적용해 넘긴다(OngoingContent.title 과 이름을 맞춘다 —
        /// 브리지는 이름으로 디코드하므로 어긋나면 빌드도 타입체크도 통과한 채 값만 사라진다).
        var title: String
        /// 본문 — 웹이 이미 번역해 넘긴다(OngoingContent.text).
        var text: String
        /// 시간 표시 기준시각(epoch ms). OS 가 이 시각으로부터 흐른 시간을 스스로 센다
        /// (OngoingContent.whenMs 와 같은 값 — Android Chronometer 와도 동일 기준).
        var whenMs: Double
    }
    // 정적 속성은 두지 않는다. 위 설명 참조.
}
