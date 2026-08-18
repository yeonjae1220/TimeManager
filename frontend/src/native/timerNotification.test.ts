import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildTimerNotificationContent,
  chronometerBaseMs,
  goalReachAtMs,
  hideTimerNotification,
  showTimerNotification,
  TIMER_NOTIFICATION_PLUGIN,
} from './timerNotification'
import { LANG_KEY, SUPPORTED_UI_LANGUAGES } from '@/i18n/messages'
import { __resetNativeBridgeWarnings } from '@/utils/nativeBridge'
import type { NativeRunningSession } from './runningSession'

const plugin = vi.hoisted(() => ({
  show: vi.fn(),
  hide: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({ registerPlugin: () => plugin }))

const NOW = new Date('2026-08-18T09:00:00.000Z').getTime()

function session(overrides: Partial<NativeRunningSession> = {}): NativeRunningSession {
  return {
    tagId: 7,
    tagName: '알고리즘',
    startedAtMs: NOW,
    baseElapsedSec: 0,
    dailyBaseSec: 0,
    dailyGoalSec: 0,
    ...overrides,
  }
}

function enableNative(available: string[] = [TIMER_NOTIFICATION_PLUGIN]) {
  window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    isPluginAvailable: (name: string) => available.includes(name),
  }
}

const content = { title: '알고리즘', text: '실행 중', whenMs: NOW }

describe('timerNotification', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    __resetNativeBridgeWarnings()
    plugin.show.mockReset().mockResolvedValue({ shown: true })
    plugin.hide.mockReset().mockResolvedValue(undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    delete window.Capacitor
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  /**
   * Chronometer 는 "기준시각으로부터 흐른 시간"만 표현할 수 있다. 화면이 그리는 값은
   * 태그 누적(base + 이번 세션)이므로, 보여주고 싶은 값을 기준시각 쪽으로 옮겨야 한다.
   * 세션 시작 시각을 그대로 넘기면 알림만 이번 세션분을 세서 화면과 다른 숫자가 뜬다.
   */
  describe('chronometerBaseMs', () => {
    it('누적이 있으면 그만큼 기준시각을 뒤로 당긴다', () => {
      expect(chronometerBaseMs(session({ baseElapsedSec: 3600 }))).toBe(NOW - 3600 * 1000)
    })

    it('누적이 0이면 세션 시작 시각 그대로다', () => {
      expect(chronometerBaseMs(session({ baseElapsedSec: 0 }))).toBe(NOW)
    })

    it('초 단위 누적을 밀리초로 환산한다 — 1000배 어긋나면 표시가 무의미해진다', () => {
      expect(chronometerBaseMs(session({ baseElapsedSec: 1 }))).toBe(NOW - 1000)
    })

    /**
     * startedAtMs 는 서버가 준 시각이라 기기 시계가 뒤처지면 미래가 될 수 있다.
     * 그대로 넘기면 Chronometer 가 음수를 센다. 웹은 이 경우를 이미 막고 있다
     * (useTagTimer.ts 의 `if (delta < 0) return prev`) — 알림도 같아야 한다.
     */
    it('시작 시각이 미래면 지금으로 클램프한다 — 음수를 세면 안 된다', () => {
      const future = session({ startedAtMs: NOW + 5000, baseElapsedSec: 0 })

      expect(chronometerBaseMs(future)).toBe(NOW)
    })

    it('미래 시작이어도 이미 쌓인 누적은 유지한다', () => {
      const future = session({ startedAtMs: NOW + 5000, baseElapsedSec: 60 })

      expect(chronometerBaseMs(future)).toBe(NOW - 60 * 1000)
    })

    /**
     * Capacitor 의 PluginCall.getLong 은 `instanceof Long` 이 아니면 그냥 null 을 준다
     * (변환하지 않는다). 소수점이 섞이면 org.json 이 Double 로 파싱해 값이 통째로
     * 사라지고, 알림은 console.warn 한 줄만 남기고 안 뜬다.
     */
    it('정수 밀리초를 돌려준다 — 소수점이 섞이면 네이티브가 값을 못 읽는다', () => {
      // 0.4ms 는 밀리초로 표현할 수 없다 — 반올림하지 않으면 소수점이 그대로 남는다.
      const fractional = session({ baseElapsedSec: 0.0004 })

      expect(Number.isInteger(chronometerBaseMs(fractional))).toBe(true)
      expect(chronometerBaseMs(fractional)).toBe(NOW)
    })
  })

  describe('showTimerNotification', () => {
    it('네이티브에서 내용을 그대로 네이티브에 넘긴다', async () => {
      enableNative()

      await showTimerNotification(content)

      expect(plugin.show).toHaveBeenCalledWith(content)
    })

    it('실제로 게시되면 true 를 돌려준다', async () => {
      enableNative()

      await expect(showTimerNotification(content)).resolves.toBe(true)
    })

    /**
     * API 33+ 에서 알림 권한이 없으면 시스템이 조용히 버린다 — 호출은 성공한다.
     * 이걸 성공으로 보고하면 나중에 권한을 허용한 사용자가 다음 상태 변화 전까지
     * 알림을 못 본다. 재수렴이 가능하려면 "안 떴다"가 호출부까지 올라와야 한다.
     */
    it('권한이 없어 게시되지 않으면 false 를 돌려준다', async () => {
      enableNative()
      plugin.show.mockResolvedValue({ shown: false })

      await expect(showTimerNotification(content)).resolves.toBe(false)
    })

    it('웹에서는 아무것도 호출하지 않고 false 다', async () => {
      await expect(showTimerNotification(content)).resolves.toBe(false)
      expect(plugin.show).not.toHaveBeenCalled()
    })

    /**
     * 원격 로드 하이브리드라 웹은 매일 배포되는데 앱 바이너리는 몇 주에 한 번 나간다.
     * 새 웹 코드가 구 바이너리에 없는 플러그인을 부르면 예외가 난다.
     */
    it('구 바이너리(플러그인 없음)에서는 조용히 건너뛰고 false 다', async () => {
      enableNative([])

      await expect(showTimerNotification(content)).resolves.toBe(false)
      expect(plugin.show).not.toHaveBeenCalled()
    })

    it('네이티브 호출이 실패해도 던지지 않고 false 다 — 타이머 조작이 깨지면 안 된다', async () => {
      enableNative()
      plugin.show.mockRejectedValue(new Error('boom'))

      await expect(showTimerNotification(content)).resolves.toBe(false)
    })

    it('구 바이너리가 shown 을 안 돌려줘도 false 로 떨어진다', async () => {
      enableNative()
      plugin.show.mockResolvedValue(undefined)

      await expect(showTimerNotification(content)).resolves.toBe(false)
    })
  })

  describe('hideTimerNotification', () => {
    it('네이티브에서 hide 를 호출하고 true 를 돌려준다', async () => {
      enableNative()

      await expect(hideTimerNotification()).resolves.toBe(true)
      expect(plugin.hide).toHaveBeenCalledTimes(1)
    })

    /**
     * 웹·구 바이너리에는 애초에 띄운 알림이 없다. "정리할 것이 없다"는 정리된 것과
     * 같으므로 true 다 — 여기서 false 를 주면 호출부가 영원히 재시도한다.
     */
    it('웹에서는 호출 없이 true (띄운 적이 없으므로 정리할 것도 없다)', async () => {
      await expect(hideTimerNotification()).resolves.toBe(true)
      expect(plugin.hide).not.toHaveBeenCalled()
    })

    it('구 바이너리에서도 호출 없이 true', async () => {
      enableNative([])

      await expect(hideTimerNotification()).resolves.toBe(true)
      expect(plugin.hide).not.toHaveBeenCalled()
    })

    it('네이티브 호출이 실패하면 false — 유령 알림이 남았을 수 있다', async () => {
      enableNative()
      plugin.hide.mockRejectedValue(new Error('boom'))

      await expect(hideTimerNotification()).resolves.toBe(false)
    })
  })
})

/**
 * 알림 본문은 **게시 시점에 얼어붙는다** — 그 뒤로는 Chronometer 숫자만 OS 가 굴리고
 * 텍스트는 다음 sync 까지 그대로다. 그래서 본문에는 "세션이 도는 동안 변하지 않는
 * 사실"만 적는다. "목표의 45% 달성" 같은 진행률을 적으면 60% 가 된 뒤에도 45% 로
 * 남아, 옆에서 초가 흐르는 만큼 더 확실하게 거짓을 말한다.
 */
describe('실행중 알림 문구', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.useRealTimers()
  })

  const clockOf = (lang: string, atMs: number) =>
    new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(new Date(atMs))

  describe('goalReachAtMs', () => {
    it('목표가 없으면 null', () => {
      expect(goalReachAtMs(session({ dailyGoalSec: 0 }))).toBeNull()
    })

    it('시작 시점에 이미 목표를 채웠으면 null', () => {
      expect(goalReachAtMs(session({ dailyGoalSec: 3600, dailyBaseSec: 3600 }))).toBeNull()
    })

    it('남은 만큼 시작 시각에서 흐른 뒤가 도달 시각', () => {
      const s = session({ dailyGoalSec: 7200, dailyBaseSec: 1800 })
      expect(goalReachAtMs(s)).toBe(NOW + 5400 * 1000)
    })
  })

  describe('buildTimerNotificationContent', () => {
    it('제목은 태그 이름', () => {
      expect(buildTimerNotificationContent(session()).title).toBe('알고리즘')
    })

    it('태그 이름이 비어 있으면 폴백 문구', () => {
      expect(buildTimerNotificationContent(session({ tagName: '' })).title).toBe('Timer')
    })

    it('whenMs 는 Chronometer 기준시각 — 화면과 같은 숫자를 그린다', () => {
      const s = session({ baseElapsedSec: 600 })
      expect(buildTimerNotificationContent(s).whenMs).toBe(chronometerBaseMs(s))
    })

    it('목표가 없으면 진행 상태만 알린다', () => {
      expect(buildTimerNotificationContent(session({ dailyGoalSec: 0 })).text).toBe('Recording')
    })

    it('시작 시점에 이미 목표를 채웠으면 달성으로 적는다', () => {
      const s = session({ dailyGoalSec: 3600, dailyBaseSec: 4000 })
      expect(buildTimerNotificationContent(s).text).toBe("Today's goal reached")
    })

    it('목표가 남아 있으면 달성 예정 **시각**을 적는다 (남은 시간이 아니라)', () => {
      const s = session({ dailyGoalSec: 7200, dailyBaseSec: 1800 })
      const eta = clockOf('en', NOW + 5400 * 1000)

      expect(buildTimerNotificationContent(s).text).toBe(`On track to reach today's goal at ${eta}`)
    })

    /**
     * 본문의 "예정 시각"과 실제로 발화하는 목표 도달 알림(90001)이 어긋나면, 사용자는
     * 알림이 온 뒤에도 상태표시줄에서 다른 시각을 읽는다. 두 값이 같은 함수에서
     * 나온다는 사실을 여기서 못박는다.
     */
    it('예정 시각은 목표 도달 알림의 발화 시각과 같은 값이다', () => {
      const s = session({ dailyGoalSec: 7200, dailyBaseSec: 1800 })
      const atMs = goalReachAtMs(s)!

      expect(buildTimerNotificationContent(s).text).toContain(clockOf('en', atMs))
    })

    it('화면 언어를 따라간다', () => {
      localStorage.setItem(LANG_KEY, 'ko')
      const s = session({ dailyGoalSec: 7200, dailyBaseSec: 1800 })

      expect(buildTimerNotificationContent(s).text)
        .toBe(`오늘 목표 달성 예정 ${clockOf('ko', NOW + 5400 * 1000)}`)
    })

    it.each(SUPPORTED_UI_LANGUAGES)('%s 에서 치환이 남지 않는다', (lang) => {
      localStorage.setItem(LANG_KEY, lang)
      const s = session({ dailyGoalSec: 7200, dailyBaseSec: 1800 })
      const { title, text } = buildTimerNotificationContent(s)

      expect(text).not.toMatch(/[{}]/)
      expect(text).toContain(clockOf(lang, NOW + 5400 * 1000))
      expect(title).toBeTruthy()
    })
  })
})
