//
//  TimerLiveActivityBundle.swift
//  TimerLiveActivity
//
//  Created by 김연재 on 8/19/26.
//
//  워치 스마트 스택 지원(supplementalActivityFamilies)은 iOS 18+ 라, 배포 타깃이
//  16.2 인 이 확장에서는 Widget 을 버전별로 갈라 고른다. 어느 쪽이 실려도 액티비티는
//  TimerActivityAttributes 타입으로 매칭되므로 웹·플러그인 쪽은 손댈 게 없다.
//
//  ⚠️ 아래 body 의 `return` 을 지우지 말 것. 두 분기가 서로 다른 타입을 돌려주는데
//  이게 성립하는 근거는 SE-0360(opaque result type 의 limited availability) 이고,
//  그 경로는 명시적 return 일 때만 열린다. return 을 빼면 @WidgetBundleBuilder
//  변환이 걸려 buildEither 를 요구하게 되고 컴파일이 깨진다.
//  위젯 목록은 그래서 아래처럼 버전별 @WidgetBundleBuilder 프로퍼티로 갈라 둔다.
//

import WidgetKit
import SwiftUI

@main
struct TimerLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        if #available(iOS 18.0, *) {
            return smartStackWidgets
        } else {
            return legacyWidgets
        }
    }

    /// iOS 18+ — 아이폰 잠금화면 + 워치 스마트 스택.
    @available(iOS 18.0, *)
    @WidgetBundleBuilder
    private var smartStackWidgets: some Widget {
        TimerLiveActivitySmartStack()
    }

    /// iOS 16.2–17 — 아이폰 전용(워치는 시스템 기본 표현).
    @WidgetBundleBuilder
    private var legacyWidgets: some Widget {
        TimerLiveActivityLiveActivity()
    }
}
