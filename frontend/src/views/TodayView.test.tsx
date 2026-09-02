import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

// 실제 zustand 스토어의 액션들은 스토어 생성 시 한 번만 만들어져 리렌더 내내 같은
// 참조를 유지한다(실제 tagStore.ts 참조). 매 셀렉터 호출마다 새 vi.fn()을 돌려주면
// TodayView의 useCallback deps(loadTags·handleOnline·addRecentTag)가 매 렌더 바뀐 것으로
// 오인되어 mount effect가 불필요하게 반복 실행된다 — 모듈 스코프 상수로 고정해 실제
// 스토어처럼 안정된 참조를 흉내낸다.
const loadTags = vi.fn()
const addRecentTag = vi.fn()
// handleOnline은 실제로 Promise를 반환한다(재전송 완료 후 화해) — 호출부(TodayView)가
// 그 완료를 기다린 뒤에만 "오늘 기록시간"을 조회하는지 검증하려면 타이밍을 제어할
// 수 있어야 한다.
let handleOnlineImpl: () => Promise<void> = () => Promise.resolve()
const handleOnline = vi.fn(() => handleOnlineImpl())

vi.mock('@/store/tagStore', () => ({
  useTagStore: Object.assign(
    (sel: (s: Record<string, unknown>) => unknown) =>
      sel({
        tagTree: [],
        loadTags,
        handleOnline,
        addRecentTag,
        recentTagIds: [],
        findById: () => null,
      }),
    { getState: () => ({ recentTagIds: [] }) },
  ),
}))

vi.mock('@/utils/timerPersistence', () => ({ peekTimerState: () => null }))

// URL별로 응답을 다르게 줄 수 있도록 실제 axios 유사 인터페이스만 흉내낸 얇은 mock.
// 기본은 항상 totalSeconds:0 — 개별 테스트가 필요하면 apiGet.mockImplementationOnce 등으로 덮어쓴다.
const apiGet = vi.fn().mockResolvedValue({ data: { totalSeconds: 0 } })
vi.mock('@/utils/apiClient', () => ({ default: { get: (...args: unknown[]) => apiGet(...args) } }))

// subscribeConnectivity에 등록된 콜백을 테스트가 직접 호출해 "온라인 전환"을 흉내낸다.
let connectivityCallback: ((online: boolean) => void) | null = null
vi.mock('@/utils/connectivity', () => ({
  isOnline: () => true,
  subscribeConnectivity: (cb: (online: boolean) => void) => {
    connectivityCallback = cb
    return () => { connectivityCallback = null }
  },
}))

// resetHour/timezone을 실제 useDailyResetHour처럼 React state로 들고 있어, 테스트가
// setDailyResetHour로 "로딩 중(null) → 확정" 전환을 재현할 수 있게 한다(예: 회귀 —
// 확정 시 mount effect 전체가 아니라 요약 조회만 다시 일어나야 한다).
let initialMockResetHour: number | null = 0
let mockTimezone: string | undefined
const reloadDailyResetHour = vi.fn()
let latestSetMockResetHour: ((v: number | null) => void) | null = null
vi.mock('@/hooks/useDailyResetHour', () => ({
  useDailyResetHour: () => {
    const [resetHour, setResetHour] = useState<number | null>(initialMockResetHour)
    latestSetMockResetHour = setResetHour
    return { resetHour, timezone: mockTimezone, failed: false, reload: reloadDailyResetHour }
  },
}))
vi.mock('@/native/haptics', () => ({ hapticStart: vi.fn(), hapticStop: vi.fn() }))
vi.mock('@/native/notificationPermission', () => ({ ensureNotificationPermission: vi.fn().mockResolvedValue(false) }))
vi.mock('@/native/runningSession', () => ({ resyncNativeRunningSession: vi.fn() }))

// useTagTimer 가짜 구현. loadTag 가 호출되면 그 tagId 로 tag state 를 갱신하고,
// 테스트가 미리 등록해둔 프리셋(mockLoadedTagPresets)에서 isRunning 여부를
// 가져온다 — "이미 실행 중인 태그를 열었을 때는 자동 시작하지 않는다" 케이스를
// 검증하기 위함이다.
const mockLoadedTagPresets = new Map<number, { name: string; isRunning: boolean }>()
// 실제 useTagTimer.startStopwatch처럼 isRunning을 true로 올린다 — 그래야 이 화면에서
// 시작→정지 흐름을 버튼 클릭으로 실제로 재현하는 테스트를 쓸 수 있다.
const startStopwatch = vi.fn(async () => {
  latestSetRunning?.(true)
})
// 실제 useTagTimer.stopStopwatch와 동일한 계약: onSegment는 정지 API 응답(여기서는
// 이 fake의 반환 Promise)보다 먼저, 동기적으로 불린다 — 그 타이밍 자체를 검증하는
// 테스트가 mockImplementationOnce로 재정의해 쓴다. 기본 구현은 즉시 확정한다.
const stopStopwatch = vi.fn(async (onSegment?: (segment: number) => void) => {
  latestSetRunning?.(false)
  onSegment?.(0)
  return 0
})
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
      // 값을 그대로 노출해야("T:100" 등) "오늘 기록시간" 타일에 실제로 어떤 값이
      // 계산돼 렌더링됐는지 텍스트로 검증할 수 있다 — 고정 문자열이면 구분이 안 된다.
      formatTime: (s: number) => `T:${s}`,
      formattedElapsedTime: '00:00:00',
      formattedDailyTotalTime: '00:00:00',
      formattedTagTotalTime: '00:00:00',
      formattedTotalTime: '00:00:00',
      formattedRemainingTime: '00:00:00',
      formattedStartTime: '',
      formattedEndTime: '',
    }
  },
  // TodayView가 포그라운드 복귀 스로틀 상수를 재사용한다(useTagTimer.ts 참조) —
  // 이 모듈 전체가 mock이므로 상수도 직접 내보내야 한다.
  FOREGROUND_REFRESH_THROTTLE_MS: 5_000,
}))

import { I18nProvider } from '@/i18n/I18nProvider'
import { LANG_KEY } from '@/i18n/messages/index'
import TodayView from './TodayView'

const getApiClientGet = () => apiGet

let mockSearch = ''

function renderToday() {
  return render(
    <I18nProvider initialLanguage="ko">
      <TodayView />
    </I18nProvider>,
  )
}

// 네트워크 응답 타이밍을 직접 제어해 "왕복이 끝나기 전" 상태를 관찰한다(useTagTimer.test.tsx와 동일 패턴).
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
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
  loadTags.mockClear()
  addRecentTag.mockClear()
  handleOnline.mockClear()
  handleOnlineImpl = () => Promise.resolve()
  connectivityCallback = null
  apiGet.mockReset()
  apiGet.mockResolvedValue({ data: { totalSeconds: 0 } })
  initialMockResetHour = 0
  mockTimezone = undefined
  latestSetMockResetHour = null
  reloadDailyResetHour.mockClear()
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

  it('[회귀] autostart 확정이 너무 늦게(10초 초과) 도착하면 더 이상 자동 시작하지 않는다', async () => {
    // 오프라인이 길게 이어지다 포그라운드 복귀로 뒤늦게 네트워크가 확정되는 상황을
    // 흉내낸다. 이 시점엔 사용자가 이미 이 화면을 잊었을 수 있으므로, 뒤늦은 확정으로
    // 타이머가 스스로 시작되면 안 된다(AUTOSTART_STALE_MS).
    autoConfirm = false
    mockSearch = 'tagId=42&autostart=1'
    mockLoadedTagPresets.set(42, { name: '독서', isRunning: false })

    vi.useFakeTimers()
    try {
      renderToday()
      await act(async () => { await Promise.resolve() })
      expect(screen.getByText('독서')).toBeTruthy()
      expect(startStopwatch).not.toHaveBeenCalled()

      vi.advanceTimersByTime(11_000)
      await act(async () => {
        pendingConfirm?.()
        await Promise.resolve()
      })

      expect(startStopwatch).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('autostart 확정이 창 안에(10초 이내) 도착하면 정상적으로 시작한다', async () => {
    // 위 회귀 테스트의 대조군 — TTL 자체가 정상 경로를 막지 않는지 확인한다.
    autoConfirm = false
    mockSearch = 'tagId=42&autostart=1'
    mockLoadedTagPresets.set(42, { name: '독서', isRunning: false })

    vi.useFakeTimers()
    try {
      renderToday()
      await act(async () => { await Promise.resolve() })

      vi.advanceTimersByTime(3_000)
      await act(async () => {
        pendingConfirm?.()
        await Promise.resolve()
      })

      expect(startStopwatch).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
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

describe('TodayView — "오늘 기록시간" 로딩 상태 (증상 2 회귀)', () => {
  it('[회귀] 서버 요약이 도착하기 전에는 태그 통계와 같은 값(0)으로 위장하지 않고 로딩 표시(—)를 보여준다', async () => {
    // /records/summary 응답을 붙잡아둔다 — 캐시 시드로 태그 통계는 이미 채워졌는데
    // 요약만 아직 없는 그 짧은 공백을 관찰한다.
    const gate = deferred<{ data: { totalSeconds: number } }>()
    apiGet.mockImplementation(async (url: string) => {
      if (String(url).includes('/records/summary')) return gate.promise
      return { data: { totalSeconds: 0 } }
    })

    mockSearch = 'tagId=42'
    mockLoadedTagPresets.set(42, { name: '독서', isRunning: false })

    renderToday()
    await waitFor(() => expect(screen.getByText('독서')).toBeTruthy())

    // 요약이 아직 안 왔으니 "오늘 기록시간"은 0이 아니라 로딩 표시여야 한다 —
    // 0으로 보이면 "오늘 태그 기록시간"(0)과 우연히 같아 보이는 회귀가 재현된다.
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.queryByText('T:0')).toBeNull()

    await act(async () => {
      gate.resolve({ data: { totalSeconds: 42 } })
      await Promise.resolve()
    })

    await waitFor(() => expect(screen.getByText('T:42')).toBeTruthy())
    expect(screen.queryByText('—')).toBeNull()
  })
})

describe('TodayView — 정지 시 "오늘 기록시간" 즉시 반영 (증상 1 회귀)', () => {
  it('[회귀] 정지 API 응답을 기다리지 않고 onSegment 콜백으로 즉시 세그먼트만큼 늘어난다', async () => {
    apiGet.mockImplementation(async (url: string) => {
      if (String(url).includes('/records/summary')) return { data: { totalSeconds: 100 } }
      return { data: { totalSeconds: 0 } }
    })

    mockSearch = 'tagId=42'
    mockLoadedTagPresets.set(42, { name: '독서', isRunning: false })

    renderToday()
    await waitFor(() => expect(screen.getByText('T:100')).toBeTruthy())

    // 시작 — fake startStopwatch가 isRunning을 true로 올린다.
    fireEvent.click(screen.getByRole('button', { name: /집중 시작/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /정지하고 저장/ })).toBeTruthy())

    // 정지 API(fake의 반환 Promise)가 아직 응답하지 않도록 붙잡아둔다.
    let resolveStop!: () => void
    stopStopwatch.mockImplementationOnce((onSegment?: (segment: number) => void) => {
      latestSetRunning?.(false)
      // 실제 useTagTimer.stopStopwatch와 동일: onSegment는 반환 Promise가 아직
      // 해소되기 전에, 동기적으로 불린다.
      onSegment?.(30)
      return new Promise<number>((resolve) => { resolveStop = () => resolve(30) })
    })

    fireEvent.click(screen.getByRole('button', { name: /정지하고 저장/ }))

    // 정지 API가 아직 응답하지 않았는데도 "오늘 기록시간"은 이미 100+30=130으로 늘어나 있어야 한다.
    await waitFor(() => expect(screen.getByText('T:130')).toBeTruthy())

    resolveStop()
  })
})

describe('TodayView — 오프라인 재접속 시 재전송 완료 후 요약 조회 (회귀)', () => {
  it('[회귀] handleOnline(재전송)이 끝난 뒤에만 "오늘 기록시간"을 조회한다', async () => {
    const events: string[] = []
    let resolveHandleOnline!: () => void
    handleOnlineImpl = () => new Promise<void>((resolve) => {
      events.push('handleOnline:start')
      resolveHandleOnline = () => { events.push('handleOnline:done'); resolve() }
    })
    apiGet.mockImplementation(async (url: string) => {
      if (String(url).includes('/records/summary')) events.push('summary:fetch')
      return { data: { totalSeconds: 0 } }
    })

    renderToday()
    await waitFor(() => expect(apiGet).toHaveBeenCalled()) // 마운트 시점 조회

    events.length = 0 // 마운트 잡음 제거 — 재접속 이후만 본다
    act(() => { connectivityCallback?.(true) })

    await waitFor(() => expect(handleOnline).toHaveBeenCalled())
    // handleOnline이 아직 안 끝났으니 요약 조회가 나가면 안 된다 — 안 그러면 큐에
    // 남은 오프라인 stop이 서버에 반영되기 전에 값을 읽어 세션분이 빠진다.
    expect(events).not.toContain('summary:fetch')

    resolveHandleOnline()
    await waitFor(() => expect(events).toEqual(['handleOnline:start', 'handleOnline:done', 'summary:fetch']))
  })
})

describe('TodayView — "오늘 기록시간" 응답 순서 가드 (회귀)', () => {
  it('[회귀] 오래된 요청의 응답이 나중에 도착해도 더 최신 요청의 값을 덮어쓰지 않는다', async () => {
    const stale = deferred<{ data: { totalSeconds: number } }>()
    let summaryCallCount = 0
    apiGet.mockImplementation(async (url: string) => {
      if (!String(url).includes('/records/summary')) return { data: { totalSeconds: 0 } }
      summaryCallCount += 1
      if (summaryCallCount === 1) return { data: { totalSeconds: 0 } } // 마운트 조회
      if (summaryCallCount === 2) return stale.promise // 오래된 재조회 — 응답 보류
      return { data: { totalSeconds: 50 } } // 최신 재조회 — 즉시 응답
    })

    mockSearch = 'tagId=42'
    mockLoadedTagPresets.set(42, { name: '독서', isRunning: false })

    renderToday()
    await waitFor(() => expect(screen.getByText('독서')).toBeTruthy())

    // 재조회 1(오래됨, 응답 보류)과 재조회 2(최신, 즉시 응답)를 연달아 발사한다.
    void appShellProps.onRefresh?.()
    await appShellProps.onRefresh?.()

    await waitFor(() => expect(screen.getByText('T:50')).toBeTruthy())

    // 오래된 응답이 뒤늦게 도착해도 최신 값을 덮어쓰면 안 된다.
    await act(async () => {
      stale.resolve({ data: { totalSeconds: 999 } })
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByText('T:50')).toBeTruthy()
    expect(screen.queryByText('T:999')).toBeNull()
  })
})

describe('TodayView — 포그라운드 복귀 시 "오늘 기록시간" 재조회 (회귀)', () => {
  it('[회귀] 포그라운드로 복귀하면 태그 통계와 별개로 "오늘 기록시간"도 다시 조회한다', async () => {
    apiGet.mockImplementation(async (url: string) => {
      if (String(url).includes('/records/summary')) return { data: { totalSeconds: 10 } }
      return { data: { totalSeconds: 0 } }
    })

    mockSearch = 'tagId=42'
    mockLoadedTagPresets.set(42, { name: '독서', isRunning: false })

    renderToday()
    await waitFor(() => expect(screen.getByText('T:10')).toBeTruthy())

    // 다른 기기에서 기록이 추가된 상황을 흉내 — 다음 응답부터 값이 바뀐다.
    apiGet.mockImplementation(async (url: string) => {
      if (String(url).includes('/records/summary')) return { data: { totalSeconds: 77 } }
      return { data: { totalSeconds: 0 } }
    })

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })

    await waitFor(() => expect(screen.getByText('T:77')).toBeTruthy())
  })
})

describe('TodayView — dailyResetHour 해소가 태그 트리 재조회를 중복시키지 않는다 (회귀)', () => {
  it('[회귀] resetHour가 로딩 중(null)에서 해소돼도 loadTags는 다시 호출되지 않는다', async () => {
    initialMockResetHour = null // "오늘"의 경계를 아직 모르는 상태로 마운트
    mockSearch = 'tagId=42'
    mockLoadedTagPresets.set(42, { name: '독서', isRunning: false })

    renderToday()
    await waitFor(() => expect(loadTags).toHaveBeenCalledTimes(1))

    apiGet.mockClear()
    act(() => { latestSetMockResetHour?.(5) }) // resetHour 해소

    // 요약 조회는 이제야 나가야 하지만(resetHour가 확정됐으니),
    await waitFor(() => expect(apiGet).toHaveBeenCalled())
    // 태그 트리 재조회는 그 해소 때문에 다시 일어나면 안 된다.
    expect(loadTags).toHaveBeenCalledTimes(1)
  })
})
