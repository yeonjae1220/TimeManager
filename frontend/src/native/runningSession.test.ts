import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetNativeRunningSession,
  resyncNativeRunningSession,
  sessionFromTimerState,
  syncNativeRunningSession,
  type NativeRunningSession,
} from './runningSession'
import { __resetNativeBridgeWarnings } from '@/utils/nativeBridge'
import { buildTimerNotificationContent, goalReachAtMs } from './timerNotification'

const plugin = vi.hoisted(() => ({
  getPending: vi.fn(),
  cancel: vi.fn(),
  schedule: vi.fn(),
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
}))

vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: plugin }))

/**
 * 실행중 알림(Android 전용 커스텀 플러그인)은 별도 표면이라 따로 세운다.
 * 래퍼 자체의 동작은 timerNotification.test.ts 가 검증하고, 여기서는 sync 가
 * 그 표면을 **어떻게 수렴시키는지**만 본다. 문구 생성은 진짜를 쓴다.
 */
const surface = vi.hoisted(() => ({
  supported: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
}))

vi.mock('./timerNotification', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./timerNotification')>()),
  supportsTimerNotification: () => surface.supported(),
  showTimerNotification: (content: unknown) => surface.show(content),
  hideTimerNotification: () => surface.hide(),
}))

const NOW = new Date('2026-08-17T09:00:00.000Z').getTime()
const HOUR = 60 * 60 * 1000

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

/** getPending 응답을 만든다. ns 를 생략하면 우리 것이 아닌 알림(남의 네임스페이스). */
function pendingEntry(id: number, extra: Record<string, unknown> | undefined) {
  return { id, title: '', body: '', extra }
}

function enableNative(available = ['LocalNotifications']) {
  window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    isPluginAvailable: (name: string) => available.includes(name),
  }
}

/** 스케줄된 알림 id 목록(호출이 없으면 빈 배열). */
function scheduledIds(): number[] {
  return plugin.schedule.mock.calls.flatMap(
    (call) => (call[0] as { notifications: Array<{ id: number }> }).notifications.map((n) => n.id),
  )
}

describe('runningSession', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    __resetNativeRunningSession()
    __resetNativeBridgeWarnings()
    plugin.getPending.mockReset().mockResolvedValue({ notifications: [] })
    plugin.cancel.mockReset().mockResolvedValue(undefined)
    plugin.schedule.mockReset().mockResolvedValue({ notifications: [] })
    plugin.checkPermissions.mockReset().mockResolvedValue({ display: 'granted' })
    plugin.requestPermissions.mockReset().mockResolvedValue({ display: 'granted' })
    surface.supported.mockReset().mockReturnValue(false)
    surface.show.mockReset().mockResolvedValue(true)
    surface.hide.mockReset().mockResolvedValue(true)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    delete (window as { Capacitor?: unknown }).Capacitor
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('sessionFromTimerState', () => {
    const base = {
      tagId: 3,
      isRunning: true,
      elapsedTime: 120,
      latestStartTime: NOW,
      latestEndTime: null,
      latestStopTimeMs: null,
      dailyTotalTime: 600,
      dailyGoalTime: 3600,
      savedAt: NOW,
    }

    it('실행 중이 아니면 null — 네이티브 표면이 없어야 한다는 뜻', () => {
      expect(sessionFromTimerState({ ...base, isRunning: false })).toBeNull()
      expect(sessionFromTimerState(null)).toBeNull()
    })

    it('시작 시각이 없으면 null — 경과시간을 셀 기준이 없다', () => {
      expect(sessionFromTimerState({ ...base, latestStartTime: 0 })).toBeNull()
      expect(sessionFromTimerState({ ...base, latestStartTime: null })).toBeNull()
    })

    it('실행 중이면 타이머 스냅샷을 그대로 옮긴다', () => {
      expect(sessionFromTimerState(base, '독서')).toEqual({
        tagId: 3,
        tagName: '독서',
        startedAtMs: NOW,
        baseElapsedSec: 120,
        dailyBaseSec: 600,
        dailyGoalSec: 3600,
      })
    })
  })

  describe('syncNativeRunningSession', () => {
    it('웹에서는 플러그인을 건드리지 않는다', async () => {
      await syncNativeRunningSession(session())
      expect(plugin.getPending).not.toHaveBeenCalled()
      expect(plugin.schedule).not.toHaveBeenCalled()
    })

    it('목표가 없으면 장시간 리마인더 3발만 건다', async () => {
      enableNative()
      await syncNativeRunningSession(session())
      expect(scheduledIds()).toEqual([90003, 90006, 90012])
    })

    it('목표가 있으면 남은 시간만큼 뒤로 목표 알림을 건다', async () => {
      enableNative()
      // 목표 3600초 중 600초는 이미 채웠으므로 시작 시각 + 3000초.
      await syncNativeRunningSession(session({ dailyGoalSec: 3600, dailyBaseSec: 600 }))

      const [[arg]] = plugin.schedule.mock.calls
      const goal = arg.notifications.find((n: { id: number }) => n.id === 90001)
      expect(goal.schedule.at.getTime()).toBe(NOW + 3000 * 1000)
      expect(goal.body).toContain('알고리즘')
    })

    it('[회귀] 모든 알림을 inexact 로 예약한다 — 정확 알람 설정 화면으로 튕기지 않도록', async () => {
      enableNative()
      await syncNativeRunningSession(session({ dailyGoalSec: 3600 }))

      const [[arg]] = plugin.schedule.mock.calls
      // isExactNotification 기본값은 true 이고, 그러면 플러그인이 API 31+ 에서
      // 시스템 "알람 및 리마인더" 설정 화면을 띄워 사용자를 앱 밖으로 내보낸다.
      // allowWhileIdle 은 이 축과 무관하다(setExact vs setExactAndAllowWhileIdle 선택일 뿐).
      for (const n of arg.notifications) {
        expect(n.isExactNotification).toBe(false)
        expect(n.schedule.allowWhileIdle).toBeUndefined()
      }
    })

    it('이미 목표를 채운 상태로 시작하면 목표 알림은 걸지 않는다', async () => {
      enableNative()
      await syncNativeRunningSession(session({ dailyGoalSec: 3600, dailyBaseSec: 3600 }))
      expect(scheduledIds()).not.toContain(90001)
    })

    it('이미 지난 시각은 예약하지 않는다 — 앱을 켜자마자 발화하는 것을 막는다', async () => {
      enableNative()
      // 7시간 전에 시작한 세션: 3h·6h 는 지났고 12h 만 남았다.
      await syncNativeRunningSession(session({ startedAtMs: NOW - 7 * HOUR }))
      expect(scheduledIds()).toEqual([90012])
    })

    it('null 이면 우리 네임스페이스의 예약을 전부 취소한다', async () => {
      enableNative()
      plugin.getPending.mockResolvedValue({
        notifications: [
          pendingEntry(90003, { ns: 'tm-timer', tagId: 7, startedAtMs: NOW }),
          pendingEntry(90012, { ns: 'tm-timer', tagId: 7, startedAtMs: NOW }),
          pendingEntry(555, { ns: 'other' }),
          pendingEntry(556, undefined),
        ],
      })

      await syncNativeRunningSession(null)

      expect(plugin.cancel).toHaveBeenCalledWith({
        notifications: [{ id: 90003 }, { id: 90012 }],
      })
      expect(plugin.schedule).not.toHaveBeenCalled()
    })

    it('우리 예약은 전부 취소하고 필요한 것만 다시 건다', async () => {
      enableNative()
      plugin.getPending.mockResolvedValue({
        notifications: [
          // 같은 태그지만 옛 시작 시각 — 정지 후 재시작된 경우다.
          pendingEntry(90003, { ns: 'tm-timer', tagId: 7, startedAtMs: NOW - HOUR }),
          pendingEntry(90006, { ns: 'tm-timer', tagId: 7, startedAtMs: NOW }),
          pendingEntry(555, { ns: 'other' }),
        ],
      })

      await syncNativeRunningSession(session())

      // 남의 네임스페이스(555)는 건드리지 않는다.
      expect(plugin.cancel).toHaveBeenCalledWith({
        notifications: [{ id: 90003 }, { id: 90006 }],
      })
      expect(scheduledIds()).toEqual([90003, 90006, 90012])
    })

    it('[회귀] 실행 중에 목표를 새로 설정하면 목표 알림이 걸린다', async () => {
      enableNative()
      await syncNativeRunningSession(session({ dailyGoalSec: 0 }))
      expect(scheduledIds()).not.toContain(90001)

      plugin.schedule.mockClear()
      // 목표 설정 → loadTag → tagId·startedAtMs 는 그대로이고 목표만 바뀐다.
      // 서명에 목표가 빠져 있으면 조기 return 에 걸려 영영 안 걸린다.
      await syncNativeRunningSession(session({ dailyGoalSec: 3600 }))

      expect(scheduledIds()).toContain(90001)
    })

    it('[회귀] 목표가 바뀌면 같은 id 의 예약 시각도 갱신된다', async () => {
      enableNative()
      plugin.getPending.mockResolvedValue({
        notifications: [pendingEntry(90001, { ns: 'tm-timer', tagId: 7, startedAtMs: NOW })],
      })

      await syncNativeRunningSession(session({ dailyGoalSec: 7200 }))

      // id 만 보고 "이미 있다"고 재사용하면 옛 시각이 남는다.
      const [[arg]] = plugin.schedule.mock.calls
      const goal = arg.notifications.find((n: { id: number }) => n.id === 90001)
      expect(goal.schedule.at.getTime()).toBe(NOW + 7200 * 1000)
    })

    it('[회귀] 권한을 나중에 허용하면 다음 sync 가 같은 세션에 알림을 건다', async () => {
      enableNative()
      plugin.checkPermissions.mockResolvedValue({ display: 'prompt' })
      await syncNativeRunningSession(session())
      expect(plugin.schedule).not.toHaveBeenCalled()

      // 권한 미허용은 "수렴 완료"가 아니므로 서명을 캐시하지 않는다 →
      // 같은 세션으로 다시 불러도 조기 return 에 걸리지 않는다.
      plugin.checkPermissions.mockResolvedValue({ display: 'granted' })
      await syncNativeRunningSession(session())

      expect(scheduledIds()).toEqual([90003, 90006, 90012])
    })

    it('resync 는 서명 캐시를 무시하고 마지막 세션으로 다시 수렴시킨다', async () => {
      enableNative()
      await syncNativeRunningSession(session())
      plugin.schedule.mockClear()

      await resyncNativeRunningSession()

      expect(scheduledIds()).toEqual([90003, 90006, 90012])
    })

    it('같은 세션으로 다시 부르면 즉시 return 한다 — 포그라운드 복귀마다 호출돼도 비용 0', async () => {
      enableNative()
      await syncNativeRunningSession(session())
      plugin.getPending.mockClear()

      await syncNativeRunningSession(session())

      expect(plugin.getPending).not.toHaveBeenCalled()
    })

    it('권한이 없으면 스케줄하지 않지만 stale 취소는 한다', async () => {
      enableNative()
      plugin.checkPermissions.mockResolvedValue({ display: 'denied' })
      plugin.getPending.mockResolvedValue({
        notifications: [pendingEntry(90003, { ns: 'tm-timer', tagId: 1, startedAtMs: 1 })],
      })

      await syncNativeRunningSession(session())

      expect(plugin.cancel).toHaveBeenCalledWith({ notifications: [{ id: 90003 }] })
      expect(plugin.schedule).not.toHaveBeenCalled()
      // 권한 요청은 여기서 하지 않는다 — 사용자 행위에 붙인다.
      expect(plugin.requestPermissions).not.toHaveBeenCalled()
    })

    it('구 바이너리(플러그인 없음)에서도 예외를 던지지 않는다', async () => {
      enableNative([])
      await expect(syncNativeRunningSession(session())).resolves.toBeUndefined()
      expect(plugin.getPending).not.toHaveBeenCalled()
    })

    it('실패하면 서명 캐시를 비워 다음 호출이 다시 시도한다', async () => {
      enableNative()
      plugin.getPending.mockRejectedValueOnce(new Error('bridge down'))

      await syncNativeRunningSession(session())
      expect(plugin.schedule).not.toHaveBeenCalled()

      await syncNativeRunningSession(session())
      expect(scheduledIds()).toEqual([90003, 90006, 90012])
    })
  })
})

/**
 * 목표 도달 시각은 **두 표면**에 동시에 나타난다 — 실행중 알림 본문의 "달성 예정
 * HH:MM" 과 실제로 발화하는 알림(90001). 둘이 어긋나면 사용자는 알림을 받은 뒤에도
 * 상태표시줄에서 다른 시각을 읽는데, 어느 쪽도 에러를 내지 않아 아무도 모른다.
 */
describe('목표 도달 시각은 예약과 문구가 한 곳에서 나온다', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    __resetNativeRunningSession()
    __resetNativeBridgeWarnings()
    plugin.getPending.mockReset().mockResolvedValue({ notifications: [] })
    plugin.cancel.mockReset().mockResolvedValue(undefined)
    plugin.schedule.mockReset().mockResolvedValue({ notifications: [] })
    plugin.checkPermissions.mockReset().mockResolvedValue({ display: 'granted' })
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      isPluginAvailable: (name: string) => name === 'LocalNotifications',
    }
  })

  afterEach(() => {
    delete window.Capacitor
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('예약된 발화 시각이 본문이 말하는 시각과 같다', async () => {
    const s = session({ dailyGoalSec: 2 * 3600, dailyBaseSec: 1800 })

    await syncNativeRunningSession(s)

    const goal = plugin.schedule.mock.calls
      .flatMap((call) => (call[0] as { notifications: Array<{ id: number, schedule: { at: Date } }> }).notifications)
      .find((n) => n.id === 90001)

    expect(goal?.schedule.at.getTime()).toBe(goalReachAtMs(s))
    expect(buildTimerNotificationContent(s).text).toContain(
      new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' })
        .format(new Date(goalReachAtMs(s)!)),
    )
  })
})

describe('실행중 알림 수렴', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    __resetNativeRunningSession()
    __resetNativeBridgeWarnings()
    localStorage.clear()
    plugin.getPending.mockReset().mockResolvedValue({ notifications: [] })
    plugin.cancel.mockReset().mockResolvedValue(undefined)
    plugin.schedule.mockReset().mockResolvedValue({ notifications: [] })
    plugin.checkPermissions.mockReset().mockResolvedValue({ display: 'granted' })
    surface.supported.mockReset().mockReturnValue(true)
    surface.show.mockReset().mockResolvedValue(true)
    surface.hide.mockReset().mockResolvedValue(true)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      isPluginAvailable: (name: string) => name === 'LocalNotifications',
    }
  })

  afterEach(() => {
    delete window.Capacitor
    localStorage.clear()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('실행 중이면 문구를 완성해 세운다', async () => {
    const s = session({ dailyGoalSec: 2 * 3600, dailyBaseSec: 1800 })

    await syncNativeRunningSession(s)

    expect(surface.show).toHaveBeenCalledWith(buildTimerNotificationContent(s))
    expect(surface.hide).not.toHaveBeenCalled()
  })

  it('정지하면 내린다', async () => {
    await syncNativeRunningSession(null)

    expect(surface.hide).toHaveBeenCalledTimes(1)
    expect(surface.show).not.toHaveBeenCalled()
  })

  /**
   * 예약(LocalNotifications)과 실행중 표시는 **다른 표면**이다. 한 쪽 실패가 다른 쪽을
   * 건너뛰면, 정지했는데 상태표시줄에 타이머가 계속 흐르는 유령이 남는다.
   */
  it('예약 경로가 실패해도 실행중 표시는 내린다', async () => {
    plugin.getPending.mockRejectedValueOnce(new Error('bridge down'))

    await syncNativeRunningSession(null)

    expect(surface.hide).toHaveBeenCalledTimes(1)
  })

  it('게시에 실패하면 서명을 비워 다음 sync 가 다시 시도한다', async () => {
    surface.show.mockResolvedValueOnce(false)

    await syncNativeRunningSession(session())
    await syncNativeRunningSession(session())

    expect(surface.show).toHaveBeenCalledTimes(2)
  })

  /**
   * iOS 네이티브·구 바이너리에는 이 플러그인이 없다. "다룰 수 없다" 를 실패로 세면
   * 매 sync 마다 서명이 리셋돼 예약까지 통째로 다시 도는 무한 재수렴이 된다.
   */
  it('플러그인이 없는 바이너리에서는 건드리지도, 재시도하지도 않는다', async () => {
    surface.supported.mockReturnValue(false)

    await syncNativeRunningSession(session())
    await syncNativeRunningSession(session())

    expect(surface.show).not.toHaveBeenCalled()
    expect(plugin.getPending).toHaveBeenCalledTimes(1)
  })

  /**
   * 서명은 "예약·문구를 바꾸는 모든 입력" 이어야 한다. 아래 셋은 알림에 그대로
   * 드러나는데 서명에 없어서, 바뀌어도 옛 내용이 그대로 남아 있었다.
   */
  it('태그 이름이 바뀌면 다시 세운다 — 제목이 옛 이름으로 남지 않도록', async () => {
    await syncNativeRunningSession(session({ tagName: '알고리즘' }))
    await syncNativeRunningSession(session({ tagName: '자료구조' }))

    expect(surface.show).toHaveBeenCalledTimes(2)
    expect(surface.show.mock.calls.at(-1)?.[0]).toMatchObject({ title: '자료구조' })
  })

  it('누적 경과시간이 바뀌면 다시 세운다 — 화면과 다른 숫자를 그리지 않도록', async () => {
    await syncNativeRunningSession(session({ baseElapsedSec: 0 }))
    await syncNativeRunningSession(session({ baseElapsedSec: 600 }))

    expect(surface.show).toHaveBeenCalledTimes(2)
    expect(surface.show.mock.calls.at(-1)?.[0]).toMatchObject({ whenMs: NOW - 600 * 1000 })
  })

  it('화면 언어가 바뀌면 다시 세운다 — 알림만 옛 언어로 남지 않도록', async () => {
    const s = session({ dailyGoalSec: 3600 })

    localStorage.setItem('tm_lang', 'en')
    await syncNativeRunningSession(s)
    localStorage.setItem('tm_lang', 'ko')
    await syncNativeRunningSession(s)

    expect(surface.show).toHaveBeenCalledTimes(2)
    expect(surface.show.mock.calls.at(-1)?.[0].text).toContain('오늘 목표')
  })
})
