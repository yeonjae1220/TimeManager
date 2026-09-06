import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { LIVE_ACTIVITY_PLUGIN } from './liveActivity'
import { TIMER_NOTIFICATION_PLUGIN } from './timerNotification'
import { findRepoRoot, readRepoFile } from '@/test-utils/repoRoot'
import { messages } from '@/i18n/messages'
import { NATIVE_OAUTH_CALLBACK_HOST, NATIVE_OAUTH_SCHEME } from '@/utils/nativeOAuth'

/**
 * TS 와 네이티브가 **같은 값을 각자 적어둔** 지점들. 한쪽만 바뀌어도 빌드·타입체크·
 * 기존 테스트가 전부 통과하고, 어긋났다는 사실 자체를 아무도 모른다.
 *
 * 특히 플러그인 이름은 단위 테스트가 원리적으로 못 잡는다 — 테스트가 `registerPlugin` 을
 * 목으로 갈아끼워 이름을 무시하고, capability 목록도 같은 TS 상수를 쓰기 때문이다.
 * 상수만 바꾸면 초록인 채로 배포되고 실기에서만 "not implemented" 가 난다.
 */

const PLUGIN_JAVA = 'frontend/android/app/src/main/java/com/mungji/timemanager/TimerNotificationPlugin.java'
const RES_DIR = 'frontend/android/app/src/main/res'

const ANDROID_MANIFEST = 'frontend/android/app/src/main/AndroidManifest.xml'

const PLUGIN_SWIFT = 'frontend/ios/App/App/LiveActivityPlugin.swift'
const CONTENT_STATE_SWIFT = 'frontend/ios/App/TimerActivityAttributes.swift'
const APP_INFO_PLIST = 'frontend/ios/App/App/Info.plist'
const ONGOING_CONTENT_TS = 'frontend/src/native/ongoingContent.ts'
const LIVE_ACTIVITY_VIEW_SWIFT = 'frontend/ios/App/TimerLiveActivity/TimerLiveActivityLiveActivity.swift'
const LIVE_ACTIVITY_BUNDLE_SWIFT = 'frontend/ios/App/TimerLiveActivity/TimerLiveActivityBundle.swift'

describe('네이티브 계약', () => {
  it('플러그인 이름이 TS 상수와 Java 애너테이션에서 같다', () => {
    const java = readRepoFile(PLUGIN_JAVA)
    const match = java.match(/@CapacitorPlugin\(\s*name\s*=\s*"([^"]+)"/)

    expect(match, `${PLUGIN_JAVA} 에서 @CapacitorPlugin(name = ...) 을 찾지 못했습니다`).not.toBeNull()
    expect(match![1]).toBe(TIMER_NOTIFICATION_PLUGIN)
  })

  it('실행중 알림 id 가 리마인더 알림 id 와 겹치지 않는다', () => {
    const java = readRepoFile(PLUGIN_JAVA)
    const idMatch = java.match(/NOTIFICATION_ID\s*=\s*(\d+)/)
    expect(idMatch, 'Java 에서 NOTIFICATION_ID 를 찾지 못했습니다').not.toBeNull()
    const ongoingId = Number(idMatch![1])

    // 리마인더 id 는 runningSession.ts 안에서만 쓰이는 모듈 상수라, 내보내는 대신 소스에서 읽는다.
    const ts = readRepoFile('frontend/src/native/runningSession.ts')
    const reminderIds = [...ts.matchAll(/\bid:\s*(\d{4,})|NOTIFICATION_ID\s*=\s*(\d{4,})/g)]
      .map((m) => Number(m[1] ?? m[2]))

    expect(reminderIds.length, 'runningSession.ts 에서 리마인더 id 를 하나도 못 찾았습니다').toBeGreaterThan(0)
    expect(reminderIds).not.toContain(ongoingId)
  })

  /**
   * 알림 채널 이름은 **시스템 설정 언어**를 따르므로 웹 i18n 과 별도 리소스가 필요하다.
   * 웹에 10번째 언어가 추가되면 그 언어 사용자만 채널 이름이 조용히 영어로 남는다.
   */
  describe('알림 채널 문구가 웹 i18n 과 같은 언어를 덮는다', () => {
    const locales = Object.keys(messages)

    it('웹 로케일이 9개다 (늘어나면 아래 대조도 함께 늘어난다)', () => {
      expect(locales.length).toBe(9)
    })

    it.each(locales)('%s 에 채널 이름·설명이 있다', (locale) => {
      // en 은 기본 리소스(values/), 나머지는 values-<locale>/ 에 들어간다.
      const dir = locale === 'en' ? 'values' : `values-${locale}`
      const xml = readRepoFile(`${RES_DIR}/${dir}/strings.xml`)

      expect(xml, `${dir}: timer_ongoing_channel_name 이 없습니다`).toContain('timer_ongoing_channel_name')
      expect(xml, `${dir}: timer_ongoing_channel_description 이 없습니다`).toContain('timer_ongoing_channel_description')
    })

    it('웹에 없는 언어 리소스를 만들지 않는다 — 유지보수 대상만 늘어난다', () => {
      const dirs = readdirSync(resolve(findRepoRoot(), RES_DIR), { withFileTypes: true })
        .filter((e) => e.isDirectory() && /^values-[a-z]{2}$/.test(e.name))
        .map((e) => e.name.replace('values-', ''))

      expect(dirs.sort()).toEqual(locales.filter((l) => l !== 'en').sort())
    })
  })
})

/**
 * iOS 축(TM-ADR-012 C6). 아래 항목들은 전부 **"틀려도 에러가 안 나는"** 종류다 —
 * 브리지는 이름으로 디코드하므로 한쪽만 바뀌면 빌드·타입체크·기존 테스트가 전부
 * 통과한 채 값만 조용히 사라지고, Info.plist 누락은 아예 무증상 무동작이다.
 */
describe('네이티브 계약 (iOS)', () => {
  it('플러그인 이름이 TS 상수와 Swift jsName 에서 같다', () => {
    const swift = readRepoFile(PLUGIN_SWIFT)
    const match = swift.match(/jsName\s*=\s*"([^"]+)"/)

    expect(match, `${PLUGIN_SWIFT} 에서 jsName = "..." 을 찾지 못했습니다`).not.toBeNull()
    expect(match![1]).toBe(LIVE_ACTIVITY_PLUGIN)
  })

  /**
   * 단위 테스트가 registerPlugin 을 목으로 갈아끼우는 한 필드 이름 오타는 원리적으로
   * 못 잡는다 — Swift ContentState 와 TS OngoingContent 가 같은 필드 집합을 선언하는지
   * 소스 대 소스로 대조한다.
   */
  it('Live Activity ContentState 필드가 TS OngoingContent 키와 같다', () => {
    const swift = readRepoFile(CONTENT_STATE_SWIFT)
    const stateBlock = swift.match(/struct ContentState[^{]*\{([\s\S]*?)\n\s*\}/)
    expect(stateBlock, `${CONTENT_STATE_SWIFT} 에서 ContentState 블록을 찾지 못했습니다`).not.toBeNull()
    const swiftFields = [...stateBlock![1].matchAll(/var\s+(\w+):/g)].map((m) => m[1]).sort()

    const ts = readRepoFile(ONGOING_CONTENT_TS)
    const interfaceBlock = ts.match(/interface OngoingContent\s*\{([\s\S]*?)\n\}/)
    expect(interfaceBlock, `${ONGOING_CONTENT_TS} 에서 OngoingContent 인터페이스를 찾지 못했습니다`).not.toBeNull()
    const tsFields = [...interfaceBlock![1].matchAll(/^\s*(\w+):/gm)].map((m) => m[1]).sort()

    expect(swiftFields.length, 'Swift ContentState 에서 필드를 하나도 못 찾았습니다').toBeGreaterThan(0)
    expect(swiftFields).toEqual(tsFields)
  })

  it('App Info.plist 에 NSSupportsLiveActivities 가 켜져 있다 — 없으면 조용히 무동작한다', () => {
    const plist = readRepoFile(APP_INFO_PLIST)
    const match = plist.match(/<key>NSSupportsLiveActivities<\/key>\s*<(\w+)\/>/)

    expect(match, `${APP_INFO_PLIST} 에서 NSSupportsLiveActivities 키를 찾지 못했습니다`).not.toBeNull()
    expect(match![1]).toBe('true')
  })
})

/**
 * OAuth 콜백 딥링크 축. 스킴은 TS·iOS·Android 세 곳에 **각자 문자열로** 적혀 있어서
 * 한쪽만 바뀌면 아무 에러 없이 딥링크가 끊긴다 — 앱은 시스템 브라우저에 콜백을 남긴 채
 * 로그아웃 상태로 돌아오고, 사용자에게는 "구글 로그인이 그냥 안 된다"로만 보인다.
 */
describe('네이티브 계약 (OAuth 커스텀 스킴)', () => {
  it('iOS Info.plist 의 CFBundleURLSchemes 가 TS 상수와 같다', () => {
    const plist = readRepoFile(APP_INFO_PLIST)
    const block = plist.match(/<key>CFBundleURLSchemes<\/key>\s*<array>([\s\S]*?)<\/array>/)

    expect(block, `${APP_INFO_PLIST} 에서 CFBundleURLSchemes 를 찾지 못했습니다`).not.toBeNull()
    const schemes = [...block![1].matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1])
    expect(schemes).toContain(NATIVE_OAUTH_SCHEME)
  })

  it('AndroidManifest 의 커스텀 스킴 intent-filter 가 TS 상수와 같다', () => {
    const xml = readRepoFile(ANDROID_MANIFEST)
    const data = [...xml.matchAll(/<data\s+android:scheme="([^"]+)"(?:\s+android:host="([^"]+)")?[^>]*\/>/g)]
      .map(([, scheme, host]) => ({ scheme, host }))

    expect(data.some((d) => d.scheme === NATIVE_OAUTH_SCHEME && d.host === NATIVE_OAUTH_CALLBACK_HOST))
      .toBe(true)
  })

  it('커스텀 스킴 intent-filter 에 BROWSABLE 이 있다 — 없으면 브라우저가 링크를 못 넘긴다', () => {
    const xml = readRepoFile(ANDROID_MANIFEST)
    const filters = [...xml.matchAll(/<intent-filter[\s\S]*?<\/intent-filter>/g)].map((m) => m[0])
    const custom = filters.find((f) => f.includes(`android:scheme="${NATIVE_OAUTH_SCHEME}"`))

    expect(custom, `${ANDROID_MANIFEST} 에서 커스텀 스킴 intent-filter 를 찾지 못했습니다`).toBeDefined()
    expect(custom).toContain('android.intent.category.BROWSABLE')
    expect(custom).toContain('android.intent.category.DEFAULT')
  })

  /**
   * Universal/App Links 는 유료 계정·서명 지문이 갖춰지면 이 폴백보다 우선한다.
   * 폴백이 생겼다고 원래 경로를 지우면 그때 되돌릴 것이 없어지므로 함께 남아 있는지 고정한다.
   */
  it('App Links(https) intent-filter 가 함께 남아 있다', () => {
    const xml = readRepoFile(ANDROID_MANIFEST)
    expect(xml).toContain('android:autoVerify="true"')
    expect(xml).toMatch(/android:scheme="https"\s+android:host="timemanager\.mungji\.com"/)
  })
})


/**
 * Live Activity **표시** 축(TM-ADR-012 C2/C5). 여기 있는 결함은 컴파일도 되고 타입체크도
 * 통과하며, 짧은 세션이나 밝은 배경에서는 눈으로도 안 보인다 — 실제로 두 건 다 배포된
 * 뒤 실기에서만 드러났다(1시간 넘는 세션의 Dynamic Island 잘림, iOS 17.5 잠금화면 대비).
 * CI 의 ios-build 잡은 "컴파일이 깨졌는가"만 보므로 이 둘이 되돌려져도 초록불이다.
 *
 * 렌더 결과로 확인하려면 ViewInspector 같은 외부 의존성이나 스냅샷 기준 이미지가
 * 필요한데, 그래도 대비 쪽은 못 잡는다 — `activityBackgroundTint` 는 실제 Live Activity
 * 밖에서 무동작이라 스냅샷에 배경이 아예 안 찍힌다. 그래서 소스 대조로 고정한다:
 * 픽셀이 아니라 **그 결정이 소스에 남아 있는지**를 지킨다. 잡을 수 있는 것은 "되돌림"이고,
 * "새로 생긴 다른 표시 결함"은 못 잡는다.
 */
describe('Live Activity 렌더러 (iOS)', () => {
  it('Dynamic Island compactTrailing 을 고정 폭이 아니라 하한으로 제약한다', () => {
    const swift = readRepoFile(LIVE_ACTIVITY_VIEW_SWIFT)
    const block = swift.match(/compactTrailing:\s*\{([\s\S]*?)\n\s*\}\s*minimal:/)

    expect(block, `${LIVE_ACTIVITY_VIEW_SWIFT} 에서 compactTrailing 블록을 찾지 못했습니다`).not.toBeNull()

    // 44pt 는 `MM:SS`(5자) 기준이라 한 시간을 넘겨 `H:MM:SS`(7자)가 되면 `2:0…` 로 잘린다.
    // 이 앱은 12시간+ 세션을 명시적으로 지원한다(runningSession.ts LONG_RUN_REMINDERS).
    expect(block![1], 'compactTrailing 에 .frame(minWidth:) 가 없습니다').toMatch(/\.frame\(\s*minWidth:/)
    expect(block![1], 'compactTrailing 이 고정 폭(.frame(width:))으로 돌아갔습니다 — 긴 세션에서 시간이 잘립니다')
      .not.toMatch(/\.frame\(\s*width:/)
  })

  it('잠금화면 배색이 배경과 전경을 함께 못박는다', () => {
    const swift = readRepoFile(LIVE_ACTIVITY_VIEW_SWIFT)
    const helper = swift.match(/func lockScreenActivityStyle\(\)[^{]*\{([\s\S]*?)\n {4}\}/)

    expect(helper, `${LIVE_ACTIVITY_VIEW_SWIFT} 에서 lockScreenActivityStyle 을 찾지 못했습니다`).not.toBeNull()

    // 배경을 우리가 어둡게 강제해놓고 글자색을 시스템(.primary)에 맡기면 둘이 어긋난다 —
    // iOS 17.5 실측에서 어두운 카드 위에 제목·타이머가 검게 렌더돼 사실상 안 읽혔다.
    expect(helper![1], '전제가 깨졌습니다: 이 헬퍼가 더는 배경 틴트를 정하지 않습니다').toContain('activityBackgroundTint')
    expect(helper![1], '배경을 정하면서 colorScheme 을 안 정했습니다 — iOS 17 잠금화면에서 글자가 배경에 묻힙니다')
      .toMatch(/\.environment\(\\\.colorScheme,\s*\.\w+\)/)
  })

  /**
   * 화면에 나오는 것은 전부 공용 뷰 한 벌에서 나와야 한다 — 버전별 Widget 이 각자
   * 배치를 들고 있으면 위 두 수정이 한쪽에만 적용되고 다른 쪽은 조용히 남는다
   * (GLOBAL-PIT-132: 같은 로직이 두 벌이면 한 벌만 고쳐진다).
   */
  it('버전별 Widget 두 개가 같은 설정 함수를 통과한다', () => {
    const swift = readRepoFile(LIVE_ACTIVITY_VIEW_SWIFT)

    for (const widget of ['TimerLiveActivityLiveActivity', 'TimerLiveActivitySmartStack']) {
      const body = swift.match(new RegExp(`struct ${widget}: Widget \\{([\\s\\S]*?)\\n\\}`))
      expect(body, `${widget} 를 찾지 못했습니다`).not.toBeNull()
      expect(body![1], `${widget} 가 공용 설정(timerActivityConfiguration)을 안 씁니다`)
        .toContain('timerActivityConfiguration')
    }

    // 배경 틴트가 헬퍼 밖에서도 칠해지면 위 대비 검사를 우회한다.
    // 주석에도 이름이 등장하므로 호출 모양(`.activityBackgroundTint(`)으로만 센다.
    expect(swift.match(/\.activityBackgroundTint\(/g) ?? [], 'activityBackgroundTint 가 헬퍼 밖에서도 쓰입니다')
      .toHaveLength(1)
  })

  it('잠금화면 뷰를 쓰는 자리마다 배색 헬퍼가 붙어 있다', () => {
    const swift = readRepoFile(LIVE_ACTIVITY_VIEW_SWIFT)
    // 선언(`private struct LockScreenView`)이 아니라 사용처(`LockScreenView(state:`)만 센다.
    const uses = swift.split(/LockScreenView\(state:[^)]*\)/).slice(1)

    expect(uses.length, '잠금화면 뷰 사용처를 하나도 못 찾았습니다').toBeGreaterThanOrEqual(2)
    for (const after of uses) {
      expect(after.trimStart(), '.lockScreenActivityStyle() 없이 잠금화면 뷰를 쓰는 자리가 있습니다')
        .toMatch(/^\.lockScreenActivityStyle\(\)/)
    }
  })

  /**
   * 두 Widget 중 하나라도 번들에서 빠지면 그 OS 대역에서 Live Activity 가 통째로 안 뜬다 —
   * 크래시가 아니라 무동작이라 아무 신호가 없다.
   */
  it('WidgetBundle 이 버전별 Widget 을 둘 다 싣는다', () => {
    const bundle = readRepoFile(LIVE_ACTIVITY_BUNDLE_SWIFT)

    expect(bundle).toContain('TimerLiveActivitySmartStack()')
    expect(bundle).toContain('TimerLiveActivityLiveActivity()')
    // SE-0360 — 두 분기가 다른 타입을 돌려주는 근거라 명시적 return 이 빠지면 컴파일이 깨진다.
    // 컴파일 에러라 ios-build 가 잡지만, 왜 있는지를 여기 남겨 되돌림 시도 자체를 줄인다.
    expect(bundle).toMatch(/return smartStackWidgets/)
    expect(bundle).toMatch(/return legacyWidgets/)
  })

  /**
   * 여기부터 셋은 **워치 스마트 스택 자체**를 지킨다(TM-ADR-019).
   *
   * 위 검사들이 잡는 표시 결함과 달리, 워치 지원은 *지워도 아무 신호가 없다*.
   * `.supplementalActivityFamilies([.small])` 한 줄을 빼면 컴파일도 되고
   * `ios-build` 도 초록이며 아이폰 표시는 전혀 안 바뀐다 — 워치에서만 태그명이
   * 사라져 ADR-019 이전 상태(시간은 흐르는데 무엇이 도는지 모름)로 조용히 돌아간다.
   * 그 표면은 CI 가 볼 수 없고 실기 워치를 꺼내야만 보이므로 여기서 못박는다.
   */
  it('iOS 18 Widget 이 워치 스마트 스택 지원을 선언한다', () => {
    const swift = readRepoFile(LIVE_ACTIVITY_VIEW_SWIFT)
    const smartStack = swift.match(/struct TimerLiveActivitySmartStack: Widget \{([\s\S]*?)\n\}/)

    expect(smartStack, 'TimerLiveActivitySmartStack 를 찾지 못했습니다').not.toBeNull()
    expect(smartStack![1], 'supplementalActivityFamilies 가 사라졌습니다 — 워치에 태그명이 안 보입니다')
      .toMatch(/\.supplementalActivityFamilies\(\s*\[\s*\.small\s*\]\s*\)/)

    // iOS 18+ API 라 구버전 Widget 에 붙으면 배포 타깃 16.2 에서 컴파일이 깨진다.
    const legacy = swift.match(/struct TimerLiveActivityLiveActivity: Widget \{([\s\S]*?)\n\}/)
    expect(legacy, 'TimerLiveActivityLiveActivity 를 찾지 못했습니다').not.toBeNull()
    expect(legacy![1], '구버전(16.2) Widget 에 iOS 18 전용 API 가 붙었습니다')
      .not.toContain('supplementalActivityFamilies')
  })

  it('.small(워치) 분기가 워치 전용 뷰로 간다', () => {
    const swift = readRepoFile(LIVE_ACTIVITY_VIEW_SWIFT)

    // family 를 읽지 않으면 분기 자체가 성립하지 않는다.
    expect(swift, '@Environment(\\.activityFamily) 가 없습니다 — 표면을 구분할 수 없습니다')
      .toMatch(/@Environment\(\\\.activityFamily\)/)

    const branch = swift.match(/case\s+\.small:([\s\S]*?)\n\s*(?:case\s|default:)/)
    expect(branch, '.small 분기를 찾지 못했습니다').not.toBeNull()
    expect(branch![1], '.small 이 더는 워치 전용 뷰를 그리지 않습니다 — 잠금화면 배치가 워치에 나옵니다')
      .toContain('SmartStackView(state:')
  })

  it('워치 뷰가 태그명을 보여주고 부연 문구는 빼둔다', () => {
    const swift = readRepoFile(LIVE_ACTIVITY_VIEW_SWIFT)
    const view = swift.match(/private struct SmartStackView: View \{([\s\S]*?)\n\}/)

    expect(view, 'SmartStackView 를 찾지 못했습니다').not.toBeNull()

    // ADR-019 가 워치 지원을 넣은 이유가 이 한 줄이다 — 없으면 기능이 무의미해진다.
    expect(view![1], '워치 뷰에서 title 이 빠졌습니다 — 무엇이 도는지 안 보입니다')
      .toContain('state.title')
    // 흘끗 보는 표면이라 문장을 읽게 만들지 않는다(Apple .small 지침).
    expect(view![1], '워치 뷰에 부연 문구(text)가 들어갔습니다').not.toContain('state.text')
  })
})
