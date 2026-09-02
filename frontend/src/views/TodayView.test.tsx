import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'

// 이 테스트의 초점은 태그 탭 "시작" 버튼(?tagId=X&autostart=1)으로 도착했을 때
// 오늘 화면이 정확히 한 번 자동 시작하는가 하나다. useTagTimer 자체의 타이머
// 로직(틱·wake lock 등)은 useTagTimer.test.tsx 가 이미 검증하므로, 여기서는
// 그 훅을 얇은 가짜로 바꿔 TodayView 의 오케스트레이션(언제 startStopwatch를
// 부르는가)만 분리해서 본다.
const push = vi.fn()
const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '1' }),
  useRouter: () => ({ push, replace, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(mockSearch),
}))

const appShellProps: { onRefresh?: () => Promise<unknown> } = {}
vi.mock('@/components/layout/AppShell', () => ({
  default: ({ children, onRefresh }: { children: React.ReactNode; onRefresh?: () => Promise<unknown> }) => {
    appShellProps.onRefresh = onRefresh
    return <div>{children}</div>
  },
}))
vi.mock('@/components/TagPickerModal', () => ({ default: () => null }))
vi.mock('@/components/DailyGoalSheet', () => ({ default: () => null }))

vi.mock('@/store/tagStore', () => ({
  useTagStore: Object.assign(
    (sel: (s: Record<string, unknown>) => unknown) =>
      sel({
        tagTree: [],
        loadTags: vi.fn(),
        handleOnline: vi.fn(),
        addRecentTag: vi.fn(),
        recentTagIds: [],
        findById: () => null,
      }),
    { getState: () => ({ recentTagIds: [] }) },
  ),
}))

vi.mock('@/utils/timerPersistence', () => ({ peekTimerState: () => null }))
vi.mock('@/utils/apiClient', () => ({ default: { get: vi.fn().mockResolvedValue({ data: { totalSeconds: 0 } }) } }))
vi.mock('@/utils/connectivity', () => ({
  isOnline: () => true,
  subscribeConnectivity: () => () => {},
}))
vi.mock('@/hooks/useDailyResetHour', () => ({
  useDailyResetHour: () => ({ resetHour: 0, failed: false, reload: vi.fn() }),
}))
vi.mock('@/native/haptics', () => ({ hapticStart: vi.fn(), hapticStop: vi.fn() }))
vi.mock('@/native/notificationPermission', () => ({ ensureNotificationPermission: vi.fn().mockResolvedValue(false) }))
vi.mock('@/native/runningSession', () => ({ resyncNativeRunningSession: vi.fn() }))

// useTagTimer 가짜 구현. loadTag 가 호출되면 그 tagId 로 tag state 를 갱신하고,
// 테스트가 미리 등록해둔 프리셋(mockLoadedTagPresets)에서 isRunning 여부를
// 가져온다 — "이미 실행 중인 태그를 열었을 때는 자동 시작하지 않는다" 케이스를
// 검증하기 위함이다.
const mockLoadedTagPresets = new Map<number, { name: string; isRunning: boolean }>()
const startStopwatch = vi.fn(async () => {})
const stopStopwatch = vi.fn(async () => 0)
const resetStopwatch = vi.fn()
type FakeTag = { id: number; name: string }
let latestSetTag: ((t: FakeTag) => void) | null = null
let latestSetRunning: ((b: boolean) => void) | null = null
let latestSetConfirmed: ((id: number | null) => void) | null = null
// 기본은 즉시 확정(대부분의 테스트는 캐시/네트워크 2단계 타이밍에 관심 없음).
// 그 타이밍 자체를 검증하는 테스트만 false 로 두고 pendingConfirm 을 직접 호출한다.
let autoConfirm = true
let pendingConfirm: (() => void) | null = null
const loadTag = vi.fn(async (tagId: number) => {
  const preset = mockLoadedTagPresets.get(tagId) ?? { name: `tag-${tagId}`, isRunning: false }
  // 실제 useTagTimer.loadTag 와 동일한 2단계: 캐시 렌더(tag/isRunning) → 네트워크
  // 확정(confirmedTagId). 이 둘을 분리해야 "확정 전에는 시작하지 않는다"를 검증할 수 있다.
  latestSetTag?.({ id: tagId, name: preset.name })
  latestSetRunning?.(preset.isRunning)
  if (autoConfirm) {
    latestSetConfirmed?.(tagId)
    return
  }
  await new Promise<void>((resolve) => {
    pendingConfirm = () => {
      latestSetConfirmed?.(tagId)
      resolve()
    }
  })
})

vi.mock('@/hooks/useTagTimer', () => ({
  useTagTimer: () => {
    const [tag, setTag] = useState<{ id: number; name: string } | null>(null)
    const [isRunning, setIsRunning] = useState(false)
    const [confirmedTagId, setConfirmedTagId] = useState<number | null>(null)
    latestSetTag = setTag
    latestSetRunning = setIsRunning
    latestSetConfirmed = setConfirmedTagId
    return {
      tag,
      confirmedTagId,
      sw: {
        isRunning,
        latestStartTime: 0,
        latestEndTime: 0,
        elapsedTime: 0,
        dailyTotalTime: 0,
        dailyGoalTime: 0,
        tagTotalTime: 0,
        totalTime: 0,
        elapsedTimeCal: 0,
        dailyTotalTimeCal: 0,
        tagTotalTimeCal: 0,
        totalTimeCal: 0,
      },
      isWakeLockActive: false,
      loadTag,
      startStopwatch,
      stopStopwatch,
      resetStopwatch,
      formatTime: () => '00:00:00',
      formattedElapsedTime: '00:00:00',
      formattedDailyTotalTime: '00:00:00',
      formattedTagTotalTime: '00:00:00',
      formattedTotalTime: '00:00:00',
      formattedRemainingTime: '00:00:00',
      formattedStartTime: '',
      formattedEndTime: '',
    }
  },
}))

import { I18nProvider } from '@/i18n/I18nProvider'
import { LANG_KEY } from '@/i18n/messages/index'
import TodayView from './TodayView'
import apiClient from '@/utils/apiClient'

const getApiClientGet = () => apiClient.get as unknown as ReturnType<typeof vi.fn>

let mockSearch = ''

function renderToday() {
  return render(
    <I18nProvider initialLanguage="ko">
      <TodayView />
    </I18nProvider>,
  )
}

beforeEach(() => {
  mockSearch = ''
  mockLoadedTagPresets.clear()
  autoConfirm = true
  pendingConfirm = null
  push.mockReset()
  replace.mockReset()
  startStopwatch.mockClear()
  stopStopwatch.mockClear()
  resetStopwatch.mockClear()
  loadTag.mockClear()
  localStorage.setItem(LANG_KEY, 'ko')
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('TodayView — 태그 탭 시작 버튼(autostart) 오케스트레이션', () => {
  it('[회귀] ?tagId=X&autostart=1 로 도착하면 태그가 로드된 뒤 정확히 한 번 시작한다', async () => {
    mockSearch = 'tagId=42&autostart=1'
    mockLoadedTagPresets.set(42, { name: '독서', isRunning: false })

    renderToday()

    await waitFor(() => expect(loadTag).toHaveBeenCalledWith(42, 1))
    await waitFor(() => expect(startStopwatch).toHaveBeenCalledTimes(1))
  })

  it('[회귀] 캐시 렌더(confirmedTagId 확정 전)에는 시작하지 않고, 네트워크 확정 후에만 시작한다', async () => {
    // loadTag는 실제 훅처럼 tag/isRunning을 먼저 캐시로 그리고, confirmedTagId는
    // 나중에(네트워크 응답) 별도로 붙는다. 이 간극에서 시작해버리면 stale 캐시
    // 값(elapsed/daily)을 시작 기준으로 쓰게 되고, 캐시가 우연히 "실행 중"으로
    // 보이면 자동 시작이 조용히 영구 취소된다 — 그래서 반드시 확정을 기다려야 한다.
    autoConfirm = false
    mockSearch = 'tagId=42&autostart=1'
    mockLoadedTagPresets.set(42, { name: '독서', isRunning: false })

    renderToday()

    // 캐시 단계: 태그 이름은 이미 화면에 보이지만 아직 시작하지 않았다.
    await waitFor(() => expect(screen.getByText('독서')).toBeTruthy())
    expect(startStopwatch).not.toHaveBeenCalled()

    // 네트워크 확정을 흉내낸다.
    pendingConfirm?.()

    await waitFor(() => expect(startStopwatch).toHaveBeenCalledTimes(1))
  })

  it('[회귀] autostart 파라미터를 소비한 뒤 URL에서 제거한다(재진입 시 재시작 방지)', async () => {
    mockSearch = 'tagId=42&autostart=1'
    mockLoadedTagPresets.set(42, { name: '독서', isRunning: false })

    renderToday()

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/members/1/today?tagId=42'))
  })

  it('[회귀] 이미 실행 중인 태그를 autostart로 열면 다시 시작하지 않는다', async () => {
    mockSearch = 'tagId=42&autostart=1'
    mockLoadedTagPresets.set(42, { name: '독서', isRunning: true })

    renderToday()

    await waitFor(() => expect(loadTag).toHaveBeenCalledWith(42, 1))
    // isRunning 이 true 로 로드되면 sw.isRunning 이 true 인 상태로 렌더되고,
    // "정지하고 저장" 라벨이 보여야 자동 시작을 건너뛴 것이 확인된다.
    await waitFor(() => expect(screen.getByRole('button', { name: /정지하고 저장/ })).toBeTruthy())
    expect(startStopwatch).not.toHaveBeenCalled()
  })

  it('autostart 없이 ?tagId=X 만 있으면 자동으로 시작하지 않는다', async () => {
    mockSearch = 'tagId=42'
    mockLoadedTagPresets.set(42, { name: '독서', isRunning: false })

    renderToday()

    await waitFor(() => expect(loadTag).toHaveBeenCalledWith(42, 1))
    // 태그 로드는 됐지만 시작 버튼을 누르지 않았으니 시작하지 않는다.
    await waitFor(() => expect(screen.getByRole('button', { name: /집중 시작/ })).toBeTruthy())
    expect(startStopwatch).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })
})

describe('TodayView — pull-to-refresh 연결', () => {
  it('[회귀] AppShell에 onRefresh를 넘기고, 호출 시 오늘 합계를 다시 조회한다', async () => {
    renderToday()
    await waitFor(() => expect(getApiClientGet()).toHaveBeenCalled())

    expect(typeof appShellProps.onRefresh).toBe('function')

    getApiClientGet().mockClear()
    await appShellProps.onRefresh?.()

    // AppShell이 children만 remount해선 이 fetch에 안 닿는다(TodayView 자신의
    // effect라 부모다) — onRefresh가 실제로 연결돼 있어야만 여기서 다시 불린다.
    expect(getApiClientGet()).toHaveBeenCalled()
  })
})
