import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildOngoingContent, chronometerBaseMs, goalReachAtMs } from './ongoingContent'
import { LANG_KEY, SUPPORTED_UI_LANGUAGES } from '@/i18n/messages'
import type { NativeRunningSession } from './runningSession'

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

const clockOf = (lang: string, atMs: number) =>
  new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(new Date(atMs))

/**
 * OS 의 시간 표시는 "기준시각으로부터 흐른 시간"만 표현할 수 있다. 화면이 그리는 값은
 * 태그 누적(base + 이번 세션)이므로, 보여주고 싶은 값을 기준시각 쪽으로 옮겨야 한다.
 * 세션 시작 시각을 그대로 넘기면 표시만 이번 세션분을 세서 화면과 다른 숫자가 뜬다.
 */
describe('chronometerBaseMs', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

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
   * 그대로 넘기면 시간 표시가 음수를 센다. 웹은 이 경우를 이미 막고 있다
   * (useTagTimer.ts 의 `if (delta < 0) return prev`) — 표시도 같아야 한다.
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

/**
 * 내용은 **게시 시점에 얼어붙는다**. 그 뒤로는 OS 가 굴리는 시간 표시 숫자만 흐르고
 * 텍스트는 다음 sync 까지 그대로다. 그래서 본문에는 "세션이 도는 동안 변하지 않는
 * 사실"만 적는다. "목표의 45% 달성" 같은 진행률을 적으면 60% 가 된 뒤에도 45% 로
 * 남아, 옆에서 초가 흐르는 만큼 더 확실하게 거짓을 말한다.
 */
describe('실행중 표시 문구', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.useRealTimers()
  })

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

  describe('buildOngoingContent', () => {
    it('제목은 태그 이름', () => {
      expect(buildOngoingContent(session()).title).toBe('알고리즘')
    })

    it('태그 이름이 비어 있으면 폴백 문구', () => {
      expect(buildOngoingContent(session({ tagName: '' })).title).toBe('Timer')
    })

    it('whenMs 는 시간 표시 기준시각 — 화면과 같은 숫자를 그린다', () => {
      const s = session({ baseElapsedSec: 600 })
      expect(buildOngoingContent(s).whenMs).toBe(chronometerBaseMs(s))
    })

    it('목표가 없으면 진행 상태만 알린다', () => {
      expect(buildOngoingContent(session({ dailyGoalSec: 0 })).text).toBe('Recording')
    })

    it('시작 시점에 이미 목표를 채웠으면 달성으로 적는다', () => {
      const s = session({ dailyGoalSec: 3600, dailyBaseSec: 4000 })
      expect(buildOngoingContent(s).text).toBe("Today's goal reached")
    })

    it('목표가 남아 있으면 달성 예정 **시각**을 적는다 (남은 시간이 아니라)', () => {
      const s = session({ dailyGoalSec: 7200, dailyBaseSec: 1800 })
      const eta = clockOf('en', NOW + 5400 * 1000)

      expect(buildOngoingContent(s).text).toBe(`On track to reach today's goal at ${eta}`)
    })

    /**
     * 본문의 "예정 시각"과 실제로 발화하는 목표 도달 알림(90001)이 어긋나면, 사용자는
     * 알림이 온 뒤에도 상태표시줄에서 다른 시각을 읽는다. 두 값이 같은 함수에서
     * 나온다는 사실을 여기서 못박는다.
     */
    it('예정 시각은 목표 도달 알림의 발화 시각과 같은 값이다', () => {
      const s = session({ dailyGoalSec: 7200, dailyBaseSec: 1800 })
      const atMs = goalReachAtMs(s)!

      expect(buildOngoingContent(s).text).toContain(clockOf('en', atMs))
    })

    it('화면 언어를 따라간다', () => {
      localStorage.setItem(LANG_KEY, 'ko')
      const s = session({ dailyGoalSec: 7200, dailyBaseSec: 1800 })

      expect(buildOngoingContent(s).text)
        .toBe(`오늘 목표 달성 예정 ${clockOf('ko', NOW + 5400 * 1000)}`)
    })

    it.each(SUPPORTED_UI_LANGUAGES)('%s 에서 치환이 남지 않는다', (lang) => {
      localStorage.setItem(LANG_KEY, lang)
      const s = session({ dailyGoalSec: 7200, dailyBaseSec: 1800 })
      const { title, text } = buildOngoingContent(s)

      expect(text).not.toMatch(/[{}]/)
      expect(text).toContain(clockOf(lang, NOW + 5400 * 1000))
      expect(title).toBeTruthy()
    })
  })
})

/**
 * 세션의 숫자는 검증되지 않은 API 응답과 localStorage 스냅샷에서 온다. 타입은 number
 * 라고 적혀 있지만 그건 선언일 뿐이라, NaN·undefined 가 그대로 흘러든다.
 *
 * 여기서 던지면 피해가 문구에서 끝나지 않는다 — 문구 생성은 sync 의 try/catch 밖이라
 * sync 전체가 reject 하고, 그걸 await 하는 로그아웃이 세션 정리 전에 멈춘다.
 */
describe('망가진 숫자를 받아도 무너지지 않는다', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    localStorage.clear()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    localStorage.clear()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('목표가 NaN 이면 목표 없음으로 강등한다 — "달성" 이라고 말하지 않는다', () => {
    const { text } = buildOngoingContent(session({ dailyGoalSec: Number.NaN }))

    expect(text).toBe('Recording')
  })

  /** 내보낸 함수라 호출부가 늘어난다 — "null 이거나 유한한 epoch" 를 계약으로 못박는다. */
  it('goalReachAtMs 는 NaN 을 돌려주지 않는다', () => {
    expect(goalReachAtMs(session({ dailyGoalSec: Number.NaN }))).toBeNull()
    expect(goalReachAtMs(session({ dailyGoalSec: 3600, dailyBaseSec: Number.NaN }))).not.toBeNaN()
    expect(goalReachAtMs(session({ dailyGoalSec: 3600, startedAtMs: Number.NaN }))).not.toBeNaN()
  })

  it('오늘 누적이 NaN 이어도 달성 시각을 지어내지 않는다', () => {
    const s = session({ dailyGoalSec: 3600, dailyBaseSec: Number.NaN })

    expect(() => buildOngoingContent(s)).not.toThrow()
    expect(goalReachAtMs(s)).toBe(NOW + 3600 * 1000)
  })

  it('시작 시각이 NaN 이어도 기준시각은 유한하다', () => {
    const s = session({ startedAtMs: Number.NaN, dailyGoalSec: 3600 })

    expect(() => buildOngoingContent(s)).not.toThrow()
    expect(Number.isFinite(buildOngoingContent(s).whenMs)).toBe(true)
  })

  it('누적 경과시간이 NaN 이면 이번 세션분만 센다', () => {
    expect(buildOngoingContent(session({ baseElapsedSec: Number.NaN })).whenMs).toBe(NOW)
  })

  it('강등은 조용히 넘어가지 않는다 — 흔적을 남긴다', () => {
    buildOngoingContent(session({ dailyGoalSec: Number.NaN }))

    expect(console.warn).toHaveBeenCalled()
  })
})

/**
 * "예정" 은 그 시각이 지나면 거짓이 된다. 진행률(%)을 피한 이유와 같은 병이라,
 * 같은 기준으로 막는다.
 */
describe('달성 예정 시각이 지나면', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.useRealTimers()
  })

  it('지나간 시각을 "예정" 이라고 말하지 않는다', () => {
    const s = session({ dailyGoalSec: 3600 })
    vi.setSystemTime(NOW + 3 * 60 * 60 * 1000)

    expect(buildOngoingContent(s).text).toBe("Today's goal reached")
  })

  it('아직 안 지났으면 그대로 예정으로 적는다', () => {
    const s = session({ dailyGoalSec: 3600 })
    vi.setSystemTime(NOW + 30 * 60 * 1000)

    expect(buildOngoingContent(s).text).toContain('On track')
  })

  /** 예약(90001)은 "지났으면 안 건다" 를 이미 따로 처리한다 — 그 규칙을 바꾸지 않는다. */
  it('예약이 쓰는 goalReachAtMs 자체는 시간에 따라 변하지 않는다', () => {
    const s = session({ dailyGoalSec: 3600 })
    const before = goalReachAtMs(s)
    vi.setSystemTime(NOW + 3 * 60 * 60 * 1000)

    expect(goalReachAtMs(s)).toBe(before)
  })
})
