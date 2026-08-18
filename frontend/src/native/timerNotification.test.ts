import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  chronometerBaseMs,
  hideTimerNotification,
  showTimerNotification,
  TIMER_NOTIFICATION_PLUGIN,
} from './timerNotification'
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
    __resetNativeBridgeWarnings()
    plugin.show.mockReset().mockResolvedValue(undefined)
    plugin.hide.mockReset().mockResolvedValue(undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    delete window.Capacitor
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
  })

  describe('showTimerNotification', () => {
    it('네이티브에서 내용을 그대로 네이티브에 넘긴다', async () => {
      enableNative()

      await showTimerNotification(content)

      expect(plugin.show).toHaveBeenCalledWith(content)
    })

    it('웹에서는 아무것도 호출하지 않는다', async () => {
      await showTimerNotification(content)

      expect(plugin.show).not.toHaveBeenCalled()
    })

    /**
     * 원격 로드 하이브리드라 웹은 매일 배포되는데 앱 바이너리는 몇 주에 한 번 나간다.
     * 새 웹 코드가 구 바이너리에 없는 플러그인을 부르면 예외가 난다.
     */
    it('구 바이너리(플러그인 없음)에서는 조용히 건너뛴다', async () => {
      enableNative([])

      await expect(showTimerNotification(content)).resolves.toBeUndefined()
      expect(plugin.show).not.toHaveBeenCalled()
    })

    it('네이티브 호출이 실패해도 예외를 밖으로 던지지 않는다 — 타이머 조작이 깨지면 안 된다', async () => {
      enableNative()
      plugin.show.mockRejectedValue(new Error('boom'))

      await expect(showTimerNotification(content)).resolves.toBeUndefined()
    })
  })

  describe('hideTimerNotification', () => {
    it('네이티브에서 hide 를 호출한다', async () => {
      enableNative()

      await hideTimerNotification()

      expect(plugin.hide).toHaveBeenCalledTimes(1)
    })

    it('웹에서는 아무것도 호출하지 않는다', async () => {
      await hideTimerNotification()

      expect(plugin.hide).not.toHaveBeenCalled()
    })

    it('구 바이너리에서도 던지지 않는다 — 정지 경로가 막히면 유령 알림이 남는다', async () => {
      enableNative([])

      await expect(hideTimerNotification()).resolves.toBeUndefined()
      expect(plugin.hide).not.toHaveBeenCalled()
    })
  })
})
