import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

// 이 테스트의 주인공은 "조회 실패를 사용자에게 알리는가" 하나다. 그래서 화면 껍데기
// (AppShell·Link)와 인증 상태는 통과용으로만 대체하고, 데이터 경로(apiClient)와
// 렌더 로직은 실제 코드를 그대로 쓴다.
vi.mock('@/utils/apiClient', () => ({ default: { get: vi.fn() } }))
vi.mock('@/components/layout/AppShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/store/authStore', () => ({
  useAuthStore: (sel: (s: { memberId: number }) => unknown) => sel({ memberId: 1 }),
}))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

// LogsView는 탭·드릴다운 상태를 URL 쿼리에서 읽는다. push/replace가 실제로
// 쿼리를 바꾸고 그걸 useSearchParams가 다시 읽어야(리액티브) "탭을 클릭하면
// 그 탭 내용이 보인다" 류의 기존 테스트가 그대로 성립한다. useSyncExternalStore로
// 최소한의 진짜 라우터 흉내를 낸다(history.back()과 동일하게 back()은 스택을 pop).
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react')
  let query = ''
  const historyStack: string[] = []
  const listeners = new Set<() => void>()
  function emit() { listeners.forEach((l) => l()) }
  function toQuery(url: string) {
    const i = url.indexOf('?')
    return i >= 0 ? url.slice(i + 1) : ''
  }
  return {
    useRouter: () => ({
      push: (url: string) => { historyStack.push(query); query = toQuery(url); emit() },
      replace: (url: string) => { query = toQuery(url); emit() },
      back: () => { query = historyStack.pop() ?? ''; emit() },
    }),
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(
      (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb) },
      () => query,
    )),
    __resetNav: () => { query = ''; historyStack.length = 0 },
    __setQuery: (q: string) => { query = q; historyStack.length = 0; emit() },
  }
})

// TagTab 용. 태그 트리 로딩과 피커 UI 자체는 검증 대상이 아니라 "태그를 고른 뒤
// 조회가 실패하면 어떻게 보이는가"에 도달하기 위한 통로다.
const FAKE_TAG = { id: 7, name: '공부', type: 'CUSTOM', children: [] }
vi.mock('@/store/tagStore', () => ({
  useTagStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      tagTree: [FAKE_TAG],
      loadTags: vi.fn(),
      findById: (id: number) => (id === FAKE_TAG.id ? FAKE_TAG : null),
    }),
}))
vi.mock('@/components/TagPickerModal', () => ({
  default: ({ onSelect }: { onSelect: (id: number) => void }) => (
    <button onClick={() => onSelect(FAKE_TAG.id)}>피커에서 태그 고르기</button>
  ),
}))

// 하루 경계(dailyResetHour)는 별도 엔드포인트에서 온다. 훅 자체의 캐시·실패 처리는
// useDailyResetHour.test.ts 가 검증하므로, 여기서는 "경계가 이 값일 때 화면이 어느
// 날짜를 조회하는가"만 보게 훅을 직접 대체한다.
//
// 기본값 0 은 "자정 = 하루 경계", 즉 논리적 날짜와 달력 날짜가 같은 설정이다.
// 경계와 무관한 기존 테스트들이 예전과 똑같은 날짜를 조회하게 하려는 것이다.
// vi.hoisted 가 필요하다 — vi.mock 팩토리는 import 보다 먼저 평가되므로, 평범한
// const 로 두면 팩토리가 TDZ 에 걸린 변수를 읽는다.
const boundary = vi.hoisted(() => ({
  resetHour: 0 as number | null,
  timezone: undefined as string | undefined,
  failed: false,
  reload: () => {},
}))
vi.mock('@/hooks/useDailyResetHour', () => ({
  useDailyResetHour: () => boundary,
}))

/** 이 테스트에서만 경계를 바꾼다. beforeEach 가 기본값(자정 경계)으로 되돌린다. */
function setBoundary(next: Partial<typeof boundary>) {
  Object.assign(boundary, next)
}

import apiClient from '@/utils/apiClient'
import * as nextNavigation from 'next/navigation'
import { I18nProvider } from '@/i18n/I18nProvider'
import { LANG_KEY } from '@/i18n/messages/index'
import LogsView from './LogsView'

const get = apiClient.get as unknown as ReturnType<typeof vi.fn>
const resetNav = (nextNavigation as unknown as { __resetNav: () => void }).__resetNav
const setNavQuery = (nextNavigation as unknown as { __setQuery: (q: string) => void }).__setQuery

const EMPTY_SUMMARY = { data: { totalSeconds: 0, tagSummaries: [] } }

function renderLogs() {
  return render(
    <I18nProvider initialLanguage="ko">
      <LogsView />
    </I18nProvider>,
  )
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  localStorage.setItem(LANG_KEY, 'ko')
  get.mockReset()
  resetNav()
  setBoundary({ resetHour: 0, timezone: undefined, failed: false, reload: vi.fn() })
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('LogsView — 조회 실패가 사용자에게 보인다', () => {
  it('[회귀] 실패를 "기록 없음"으로 위장하지 않고 오류로 알린다', async () => {
    // 이전 코드: catch { setData(null) } → 화면에 아무 단서도 남지 않았다.
    get.mockRejectedValue(new Error('500 Internal Server Error'))

    renderLogs()

    await waitFor(() => expect(screen.getByText('불러오지 못했습니다.')).toBeTruthy())
    // "기록이 없습니다"는 성공했는데 0건일 때만 나와야 한다.
    expect(screen.queryByText('기록이 없습니다')).toBeNull()
  })

  it('[회귀] 실패 원인을 console.error 로 남긴다', async () => {
    get.mockRejectedValue(new Error('network down'))

    renderLogs()

    await waitFor(() => expect(screen.getByText('불러오지 못했습니다.')).toBeTruthy())
    const logged = (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls
      .flat().map(String).join(' ')
    expect(logged).toContain('network down')
  })

  it('재시도 버튼을 누르면 다시 조회하고 성공 시 오류 표시가 사라진다', async () => {
    get.mockRejectedValueOnce(new Error('일시적 실패'))

    renderLogs()
    await waitFor(() => expect(screen.getByText('불러오지 못했습니다.')).toBeTruthy())

    get.mockResolvedValue(EMPTY_SUMMARY)
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => expect(screen.queryByText('불러오지 못했습니다.')).toBeNull())
    expect(screen.getByText('기록이 없습니다')).toBeTruthy()
  })

  // 일별 탭은 원래도 실패 문구를 띄웠다. 아무 표시 없이 빈 화면이 되던 것은
  // 주별·월별이라, 회귀 방어의 핵심은 이 두 개다.
  it.each([
    ['주별', 'logs.tabWeekly'],
    ['월별', 'logs.tabMonthly'],
  ])('[회귀] %s 탭도 실패를 빈 화면으로 두지 않는다', async (tabLabel) => {
    get.mockRejectedValue(new Error('500 Internal Server Error'))

    renderLogs()
    fireEvent.click(screen.getByRole('button', { name: tabLabel }))

    await waitFor(() => expect(screen.getByText('불러오지 못했습니다.')).toBeTruthy())
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
  })

  it('성공했는데 0건이면 오류가 아니라 "기록 없음"이다', async () => {
    get.mockResolvedValue(EMPTY_SUMMARY)

    renderLogs()

    await waitFor(() => expect(screen.getByText('기록이 없습니다')).toBeTruthy())
    expect(screen.queryByText('불러오지 못했습니다.')).toBeNull()
  })
})

describe('LogsView — 보조 차트의 부분 실패', () => {
  // 메인 요약과 별개로 날짜별/주별 요청을 더 던져 그래프를 그린다. 이쪽이 실패하면
  // 예전 코드는 0(막대) 또는 빈 칸(히트맵)으로 그려서, 메인 요약이 성공한 상황에서는
  // 화면 어디에도 실패 흔적이 남지 않았다 — 빈 화면보다 나쁜 "그럴듯한 거짓 데이터".

  /** 단일 날짜 조회만 실패시킨다(= 보조 차트용 요청). 기간 조회는 정상. */
  function failOnlySingleDayRequests() {
    get.mockImplementation((url: string) => {
      const m = url.match(/startDate=([\d-]+)&endDate=([\d-]+)/)
      if (m && m[1] === m[2]) return Promise.reject(new Error('per-day request failed'))
      return Promise.resolve(EMPTY_SUMMARY)
    })
  }

  /**
   * 주별 탭으로 전환하고 일별 탭이 남긴 흔적을 지운다.
   *
   * 기본 탭(일별)의 메인 요약도 startDate == endDate 라 위 mock 에 걸린다.
   * 그대로 두면 일별 탭의 실패 로그가 보조 차트의 로그로 오인돼, 차트를 안
   * 고쳐도 테스트가 통과한다(실제로 처음에 그렇게 잘못 통과했다).
   */
  async function switchToWeeklyTabAndResetLog() {
    await waitFor(() => expect(screen.getByText('불러오지 못했습니다.')).toBeTruthy())
    ;(console.error as unknown as ReturnType<typeof vi.fn>).mockClear()
    fireEvent.click(screen.getByRole('button', { name: '주별' }))
  }

  it('[회귀] 주별 막대그래프가 실패한 날을 0시간으로 그리지 않는다', async () => {
    failOnlySingleDayRequests()
    renderLogs()
    await switchToWeeklyTabAndResetLog()

    // 주간 요약(월~일)은 성공하므로 "기록 없음"이 뜬다. 그 상태에서도 차트는
    // 거짓 0 막대를 그리는 대신 아예 렌더되지 않아야 한다.
    await waitFor(() => expect(screen.getByText('기록이 없습니다')).toBeTruthy())
    expect(screen.queryByTestId('weekly-bar-chart')).toBeNull()
  })

  it('[회귀] 보조 요청 실패도 console.error 로 남긴다', async () => {
    failOnlySingleDayRequests()
    renderLogs()
    await switchToWeeklyTabAndResetLog()

    await waitFor(() => {
      const logged = (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls
        .flat().map(String).join(' ')
      expect(logged).toContain('per-day request failed')
    })
  })

  it('보조 요청이 성공하면 차트를 그린다', async () => {
    get.mockResolvedValue(EMPTY_SUMMARY)

    renderLogs()
    fireEvent.click(screen.getByRole('button', { name: '주별' }))

    await waitFor(() => expect(screen.getByTestId('weekly-bar-chart')).toBeTruthy())
  })

  it('[회귀] 월별 히트맵도 실패한 주를 빈 칸으로 그리지 않는다', async () => {
    // 히트맵은 주 단위로 조회한다. 실패한 주의 칸이 비면 "그 주엔 기록이 없다"와
    // 똑같이 보인다 — 막대그래프의 0 과 같은 부류의 거짓 데이터다.
    get.mockImplementation((url: string) => {
      const m = url.match(/startDate=([\d-]+)&endDate=([\d-]+)/)
      // 주 단위(월~일, 6일 간격) 요청만 실패시킨다.
      if (m && m[1] !== m[2]) return Promise.reject(new Error('per-week request failed'))
      return Promise.resolve(EMPTY_SUMMARY)
    })

    renderLogs()
    fireEvent.click(screen.getByRole('button', { name: '월별' }))

    await waitFor(() => expect(screen.getByText('불러오지 못했습니다.')).toBeTruthy())
    expect(screen.queryByTestId('monthly-heatmap')).toBeNull()
  })

  it('월별 히트맵은 성공하면 그린다', async () => {
    get.mockResolvedValue(EMPTY_SUMMARY)

    renderLogs()
    fireEvent.click(screen.getByRole('button', { name: '월별' }))

    await waitFor(() => expect(screen.getByTestId('monthly-heatmap')).toBeTruthy())
  })
})

describe('LogsView — 태그별 탭 기본 데이터', () => {
  /**
   * 예전엔 태그를 고르기 전까지 조회 자체를 안 했다(loader=null). 태그를 고르지
   * 않고도 "전체 태그" 합계를 먼저 보여주도록 바꿨다 — 빈 화면보다 유용하다.
   */
  it('[회귀] 태그를 고르기 전에도 전체 태그 기본 데이터를 조회해 보여준다', async () => {
    get.mockResolvedValue({
      data: {
        totalSeconds: 3600,
        tagSummaries: [{ tagId: 7, tagName: '공부', parentTagName: '', totalSeconds: 3600, sessionCount: 1, sessions: [] }],
      },
    })

    renderLogs()
    fireEvent.click(screen.getByRole('button', { name: '태그별' }))

    expect(screen.getByRole('button', { name: '전체 태그' })).toBeTruthy()
    await waitFor(() => expect(screen.getAllByText('01:00:00').length).toBeGreaterThan(0))
    // 태그를 고르지 않고도 태그별 막대까지 보인다.
    expect(screen.getByText('공부')).toBeTruthy()
  })

  it('[회귀] 태그를 고르기 전 조회 실패도 오류로 알린다(빈 화면으로 위장하지 않는다)', async () => {
    get.mockRejectedValue(new Error('tag summary failed'))

    renderLogs()
    fireEvent.click(screen.getByRole('button', { name: '태그별' }))

    await waitFor(() => expect(screen.getByText('불러오지 못했습니다.')).toBeTruthy())
    expect(screen.queryByText('해당 기간에 기록이 없습니다')).toBeNull()
  })
})

describe('LogsView — 태그별 탭에서 특정 태그 선택', () => {
  /** 태그별 탭으로 이동해 태그 하나를 고른다. */
  function selectTag() {
    fireEvent.click(screen.getByRole('button', { name: '태그별' }))
    fireEvent.click(screen.getByRole('button', { name: '전체 태그' }))
    fireEvent.click(screen.getByRole('button', { name: '피커에서 태그 고르기' }))
  }

  it('[회귀] 조회 실패를 "해당 기간에 기록이 없습니다"로 위장하지 않는다', async () => {
    // 이전 코드: .catch(() => { setCurrent(null); setPrev(null) }) 로 삼키면
    // currentFiltered=[] 가 되어 "해당 기간에 기록이 없습니다" + 기록 시작 CTA 가
    // 떴다. 빈 화면보다 나쁘다 — 침묵이 아니라 **틀린 사실을 단언**하는 화면이라
    // 사용자가 "이 기간엔 안 했구나"로 확신하고 넘어간다.
    get.mockRejectedValue(new Error('tag summary failed'))

    renderLogs()
    selectTag()

    await waitFor(() => expect(screen.getByText('불러오지 못했습니다.')).toBeTruthy())
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
    expect(screen.queryByText('해당 기간에 기록이 없습니다')).toBeNull()
    // 통계 블록도 렌더되면 안 된다(현재 구현에선 length>0 게이트에 막히지만,
    // 게이트가 바뀌어도 실패 시엔 안 나오도록 명시적으로 고정한다).
    expect(screen.queryByText('합계')).toBeNull()
  })

  it('[회귀] 실패 원인을 console.error 로 남긴다', async () => {
    get.mockRejectedValue(new Error('tag summary failed'))

    renderLogs()
    selectTag()

    await waitFor(() => {
      const logged = (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls
        .flat().map(String).join(' ')
      expect(logged).toContain('tag summary failed')
    })
  })

  it('성공했는데 0건이면 오류가 아니라 "기간 내 기록 없음"이다', async () => {
    get.mockResolvedValue(EMPTY_SUMMARY)

    renderLogs()
    selectTag()

    await waitFor(() => expect(screen.getByText('해당 기간에 기록이 없습니다')).toBeTruthy())
    expect(screen.queryByText('불러오지 못했습니다.')).toBeNull()
  })

  it('[회귀] 태그를 바꿔 골라도 같은 기간이면 재조회 없이 즉시 필터링한다', async () => {
    get.mockResolvedValue({
      data: {
        totalSeconds: 3600,
        tagSummaries: [{ tagId: 7, tagName: '공부', parentTagName: '', totalSeconds: 3600, sessionCount: 1, sessions: [] }],
      },
    })

    renderLogs()
    fireEvent.click(screen.getByRole('button', { name: '태그별' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '전체 태그' })).toBeTruthy())

    const callsBeforeSelect = get.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: '전체 태그' }))
    fireEvent.click(screen.getByRole('button', { name: '피커에서 태그 고르기' }))

    await waitFor(() => expect(screen.getByRole('button', { name: '공부' })).toBeTruthy())
    // 태그를 바꿔도 이미 받아둔 기간 데이터를 다시 필터링할 뿐, 새 요청을 보내지 않는다.
    expect(get).toHaveBeenCalledTimes(callsBeforeSelect)
  })
})

describe('LogsView — 주별/월별에서 일별 상세로 드릴다운', () => {
  it('[회귀] 주별 막대의 특정 요일을 클릭하면 그 날의 일별 상세로 이동한다', async () => {
    get.mockResolvedValue(EMPTY_SUMMARY)

    renderLogs()
    fireEvent.click(screen.getByRole('button', { name: '주별' }))
    await waitFor(() => expect(screen.getByTestId('weekly-bar-chart')).toBeTruthy())

    const dayButtons = within(screen.getByTestId('weekly-bar-chart')).getAllByRole('button')
    expect(dayButtons.length).toBe(7)
    fireEvent.click(dayButtons[0])

    // 일별 탭으로 전환되고, 어디서 왔는지 보여주는 뒤로가기가 뜬다.
    await waitFor(() => expect(screen.getByRole('button', { name: /뒤로 · 주별/ })).toBeTruthy())
  })

  it('[회귀] 월별 히트맵의 날짜를 클릭하면 그 날의 일별 상세로 이동한다', async () => {
    get.mockResolvedValue(EMPTY_SUMMARY)

    renderLogs()
    fireEvent.click(screen.getByRole('button', { name: '월별' }))
    await waitFor(() => expect(screen.getByTestId('monthly-heatmap')).toBeTruthy())

    const dayButtons = within(screen.getByTestId('monthly-heatmap')).getAllByRole('button')
    expect(dayButtons.length).toBeGreaterThan(0)
    fireEvent.click(dayButtons[0])

    await waitFor(() => expect(screen.getByRole('button', { name: /뒤로 · 월별/ })).toBeTruthy())
  })

  it('뒤로가기를 누르면 원래 있던 기간 탭으로 돌아간다', async () => {
    get.mockResolvedValue(EMPTY_SUMMARY)

    renderLogs()
    fireEvent.click(screen.getByRole('button', { name: '주별' }))
    await waitFor(() => expect(screen.getByTestId('weekly-bar-chart')).toBeTruthy())

    const dayButtons = within(screen.getByTestId('weekly-bar-chart')).getAllByRole('button')
    fireEvent.click(dayButtons[0])
    const backButton = await screen.findByRole('button', { name: /뒤로 · 주별/ })

    fireEvent.click(backButton)

    // 주별 탭으로 복귀 — 막대그래프가 다시 보인다.
    await waitFor(() => expect(screen.getByTestId('weekly-bar-chart')).toBeTruthy())
  })

  it('일별 탭을 직접 클릭해 들어가면(드릴다운이 아니면) 뒤로가기 버튼이 없다', async () => {
    get.mockResolvedValue(EMPTY_SUMMARY)

    renderLogs()
    fireEvent.click(screen.getByRole('button', { name: '일별' }))

    await waitFor(() => expect(screen.getByText('기록이 없습니다')).toBeTruthy())
    expect(screen.queryByRole('button', { name: /뒤로 · 주별/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /뒤로 · 월별/ })).toBeNull()
  })

  it('[회귀] URL의 date가 존재하지 않는 달력 날짜여도(예: 13월 45일) 굴러간 날짜로 진행하지 않고 오늘로 안전하게 대체한다', async () => {
    get.mockResolvedValue(EMPTY_SUMMARY)
    setNavQuery('tab=daily&date=2024-13-45&from=weekly')

    renderLogs()

    // 크래시 없이 렌더되고, 뒤로가기(from=weekly)는 그대로 유효하다 —
    // date만 무효 처리되고 나머지 드릴다운 컨텍스트는 살아있다.
    await waitFor(() => expect(screen.getByRole('button', { name: /뒤로 · 주별/ })).toBeTruthy())
  })
})

describe('LogsView — "오늘"의 경계는 자정이 아니라 dailyResetHour다', () => {
  /** Date만 고정한다 — setTimeout까지 가짜로 만들면 waitFor가 진행되지 않는다. */
  function freezeClockAt(d: Date) {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(d)
  }

  /**
   * 칸/막대의 접근성 이름. 컴포넌트와 같은 API로 만들어 로케일 표기에 의존하지 않는다.
   * (월별 히트맵 칸은 여기에 ": <시간>" 이 덧붙는다.)
   */
  function dayLabel(d: Date): string {
    return d.toLocaleDateString('ko', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
  }

  /** 주별 막대 중 accent 색으로 "오늘" 강조된 요일들. */
  function accentedWeekdays(chart: HTMLElement): string[] {
    return within(chart).getAllByRole('button')
      .filter((b) => Array.from(b.querySelectorAll('div')).some((d) => d.style.background === 'var(--accent)'))
      .map((b) => b.getAttribute('aria-label') ?? '')
  }

  /** 월별 히트맵 칸 중 accent 테두리로 "오늘" 강조된 날짜들. */
  function outlinedDays(heatmap: HTMLElement): string[] {
    return within(heatmap).getAllByRole('button')
      .filter((b) => b.style.outline === '2px solid var(--accent)')
      .map((b) => (b.getAttribute('aria-label') ?? '').split(':')[0])
  }

  function requestedRanges(): string[] {
    return get.mock.calls
      .map((c) => String(c[0]))
      .map((url) => url.match(/startDate=([\d-]+)&endDate=([\d-]+)/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => `${m[1]}~${m[2]}`)
  }

  it('[회귀] 자정~resetHour 사이에는 달력 오늘이 아니라 논리적 어제를 조회한다', async () => {
    // 예전엔 기본 날짜가 new Date()(달력 오늘)라, resetHour=5 인 회원이 새벽 2시에
    // 일별 탭을 열면 서버가 "9/2 05:00 ~ 9/3 05:00" 이라는 **아직 시작하지도 않은**
    // 구간을 조회했다. 결과는 언제나 0건이고, 화면은 그걸 "기록이 없습니다"로
    // 단언했다 — 그 시간대에 어제치를 보러 온 사용자에게 정확히 틀린 답이다.
    freezeClockAt(new Date(2026, 8, 2, 2, 0, 0))
    setBoundary({ resetHour: 5 })
    get.mockResolvedValue(EMPTY_SUMMARY)

    renderLogs()

    await waitFor(() => expect(requestedRanges()).toContain('2026-09-01~2026-09-01'))
    expect(requestedRanges()).not.toContain('2026-09-02~2026-09-02')
  })

  it('resetHour 이후 시간대에는 달력 날짜와 같다', async () => {
    freezeClockAt(new Date(2026, 8, 2, 14, 0, 0))
    setBoundary({ resetHour: 5 })
    get.mockResolvedValue(EMPTY_SUMMARY)

    renderLogs()

    await waitFor(() => expect(requestedRanges()).toContain('2026-09-02~2026-09-02'))
  })

  it('[회귀] 경계를 아직 모르는 동안에는 아예 조회하지 않는다', async () => {
    // 5(백엔드 기본값)로 짐작해 조회하면, 실제 설정이 다른 회원에게 엉뚱한 하루의
    // 합계를 "오늘"로 보여준다. 짐작보다 기다림이 안전하다.
    setBoundary({ resetHour: null })

    const { container } = renderLogs()

    await waitFor(() => expect(container.querySelector('.spinner')).toBeTruthy())
    expect(get).not.toHaveBeenCalled()
    expect(screen.queryByText('기록이 없습니다')).toBeNull()
  })

  it('경계 조회가 확정 실패하면 오류로 알리고 재시도를 준다', async () => {
    setBoundary({ resetHour: null, failed: true })

    renderLogs()

    await waitFor(() => expect(screen.getByText('불러오지 못했습니다.')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(boundary.reload as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalled()
  })

  it('[회귀] 월별 히트맵도 달력 날짜가 아니라 논리적 날짜로 모은다', async () => {
    // 9/2 02:00 에 시작한 세션은 resetHour=5 기준으로 9/1 에 속한다(서버가 그렇게
    // 세고, 주별 막대·일별 탭도 그렇게 보여준다). 예전엔 히트맵만 startTime의 달력
    // 날짜로 모아 9/2 칸을 칠했고, 그 칸을 눌러 들어간 일별 상세에는 그 세션이
    // 없었다 — 칸의 숫자와 드릴다운 결과가 서로 다른 하루를 가리켰다.
    freezeClockAt(new Date(2026, 8, 15, 12, 0, 0))
    setBoundary({ resetHour: 5 })

    const sessionStart = new Date(2026, 8, 2, 2, 0, 0)
    const sessionEnd = new Date(2026, 8, 4, 4, 0, 0)
    const withSession = {
      data: {
        totalSeconds: 7200,
        tagSummaries: [{
          tagId: 7, tagName: '공부', parentTagName: '', totalSeconds: 7200, sessionCount: 1,
          sessions: [{ startTime: sessionStart.toISOString(), endTime: sessionEnd.toISOString(), durationSeconds: 7200 }],
        }],
      },
    }
    get.mockImplementation((url: string) => {
      const m = url.match(/startDate=([\d-]+)&endDate=([\d-]+)/)
      if (!m) return Promise.resolve(EMPTY_SUMMARY)
      const [, start, end] = m
      // 히트맵은 주 단위로 조회한다. 세션이 속한 논리적 날짜(9/1)를 품은 주에만
      // 실어 보낸다 — 모든 요청에 담으면 주차 수만큼 중복 합산돼 검증이 무의미해진다.
      const isWeekRange = start !== end
      if (isWeekRange && start <= '2026-09-01' && '2026-09-01' <= end) return Promise.resolve(withSession)
      return Promise.resolve(EMPTY_SUMMARY)
    })

    renderLogs()
    fireEvent.click(screen.getByRole('button', { name: '월별' }))
    const heatmap = await screen.findByTestId('monthly-heatmap')

    // 칸의 접근성 이름은 "<날짜>: <시간>" 이다.
    const labels = within(heatmap).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? '')

    expect(labels).toContain(`${dayLabel(new Date(2026, 8, 1))}: 2h 0m`)
    expect(labels).toContain(`${dayLabel(new Date(2026, 8, 2))}: 0m`)
  })

  // ── "오늘" 강조(주별 막대 색·월별 칸 테두리)도 같은 경계를 따른다 ──────────────
  // 예전엔 두 차트 모두 `new Date()` 의 달력 날짜로 강조 칸을 골랐다. resetHour=5 인
  // 회원이 새벽 2시에 열면 강조된 칸은 아직 아무것도 안 들어간 빈 칸이고, 방금 기록한
  // 시간은 강조되지 않은 전날 칸에 들어가 있다 — 눈이 먼저 가는 표시가 데이터와 다른
  // 하루를 가리켰다.

  it('[회귀] 주별 막대의 "오늘" 강조는 달력 오늘이 아니라 논리적 오늘이다', async () => {
    freezeClockAt(new Date(2026, 8, 2, 2, 0, 0)) // 수요일 새벽 2시 → 논리적으로는 아직 화요일(9/1)
    setBoundary({ resetHour: 5 })
    get.mockResolvedValue(EMPTY_SUMMARY)

    renderLogs()
    fireEvent.click(screen.getByRole('button', { name: '주별' }))
    const chart = await screen.findByTestId('weekly-bar-chart')

    expect(accentedWeekdays(chart)).toEqual([dayLabel(new Date(2026, 8, 1))])
  })

  it('주별 막대는 resetHour 이후 시간대에는 달력 오늘을 강조한다', async () => {
    freezeClockAt(new Date(2026, 8, 2, 14, 0, 0))
    setBoundary({ resetHour: 5 })
    get.mockResolvedValue(EMPTY_SUMMARY)

    renderLogs()
    fireEvent.click(screen.getByRole('button', { name: '주별' }))
    const chart = await screen.findByTestId('weekly-bar-chart')

    expect(accentedWeekdays(chart)).toEqual([dayLabel(new Date(2026, 8, 2))])
  })

  it('[회귀] 경계를 아직 모르는 동안에는 어느 주가 "이번 주"인지도 정하지 않는다', async () => {
    // 예전엔 주간 조회가 경계와 무관하게 기기 달력의 "이번 주"로 즉시 나갔다 —
    // resetHour=5인 회원이 월요일 02:00에 들어오면 논리적으로는 아직 지난주
    // 일요일인데 새 주를 보여주고, 오늘 강조도 그 주 어디에도 찍히지 않았다.
    // 지금은 DailyTab과 같은 방식으로 논리적 오늘이 정해질 때까지 조회 자체를
    // 미룬다.
    freezeClockAt(new Date(2026, 8, 2, 2, 0, 0))
    setBoundary({ resetHour: null })
    get.mockResolvedValue(EMPTY_SUMMARY)

    const { container } = renderLogs()
    fireEvent.click(screen.getByRole('button', { name: '주별' }))

    await waitFor(() => expect(container.querySelector('.spinner')).toBeTruthy())
    expect(screen.queryByTestId('weekly-bar-chart')).toBeNull()
    expect(get).not.toHaveBeenCalled()
  })

  it('[회귀] 월별 히트맵의 "오늘" 테두리도 달력 오늘이 아니라 논리적 오늘이다', async () => {
    freezeClockAt(new Date(2026, 8, 2, 2, 0, 0))
    setBoundary({ resetHour: 5 })
    get.mockResolvedValue(EMPTY_SUMMARY)

    renderLogs()
    fireEvent.click(screen.getByRole('button', { name: '월별' }))
    const heatmap = await screen.findByTestId('monthly-heatmap')

    expect(outlinedDays(heatmap)).toEqual([dayLabel(new Date(2026, 8, 1))])
  })

  it('월별 히트맵은 resetHour 이후 시간대에는 달력 오늘에 테두리를 두른다', async () => {
    freezeClockAt(new Date(2026, 8, 2, 14, 0, 0))
    setBoundary({ resetHour: 5 })
    get.mockResolvedValue(EMPTY_SUMMARY)

    renderLogs()
    fireEvent.click(screen.getByRole('button', { name: '월별' }))
    const heatmap = await screen.findByTestId('monthly-heatmap')

    expect(outlinedDays(heatmap)).toEqual([dayLabel(new Date(2026, 8, 2))])
  })

  it('[회귀] 주별 탭은 달력 주가 아니라 논리적 오늘이 속한 주를 연다', async () => {
    // 예전엔 기기 달력의 "이번 주"를 즉시 조회했다. resetHour=5인 회원이 월요일
    // 새벽 2시에 열면 논리적으로는 아직 지난주 일요일인데, 화면은 이미 새 주로
    // 넘어가 있어 방금 지난주에 남긴 기록도, 오늘 강조도 그 주 어디에도 없었다.
    freezeClockAt(new Date(2026, 8, 7, 2, 0, 0)) // 월요일(9/7) 새벽 2시 → 논리적으로 아직 일요일(9/6)
    setBoundary({ resetHour: 5 })
    get.mockResolvedValue(EMPTY_SUMMARY)

    renderLogs()
    fireEvent.click(screen.getByRole('button', { name: '주별' }))
    await screen.findByTestId('weekly-bar-chart')

    expect(requestedRanges()).toContain('2026-08-31~2026-09-06')
    expect(requestedRanges()).not.toContain('2026-09-07~2026-09-13')
  })

  it('[회귀] 월별 탭은 달력 달이 아니라 논리적 오늘이 속한 달을 연다', async () => {
    // 9월 1일 새벽 2시는 resetHour=5 기준으로 아직 8월 31일이다. 예전엔 기기
    // 달력의 "이번 달"(9월)을 즉시 열어, 방금 8월 말에 남긴 기록이 안 보였다.
    freezeClockAt(new Date(2026, 8, 1, 2, 0, 0))
    setBoundary({ resetHour: 5 })
    get.mockResolvedValue(EMPTY_SUMMARY)

    renderLogs()
    fireEvent.click(screen.getByRole('button', { name: '월별' }))
    await screen.findByTestId('monthly-heatmap')

    expect(requestedRanges()).toContain('2026-08-01~2026-08-31')
    expect(requestedRanges()).not.toContain('2026-09-01~2026-09-30')
  })
})

describe('LogsView — 날짜를 넘긴 세션', () => {
  it('[회귀] 종료가 다음 날이면 시:분 옆에 (+1)을 붙인다', async () => {
    // `23:00 → 01:30` 만 보면 시간이 거꾸로 흐른 것처럼 읽힌다. 어느 날 기록으로
    // 집계되는지(시작 시각 기준)와 별개로, 시계가 되감긴 이유는 보여줘야 한다.
    get.mockResolvedValue({
      data: {
        totalSeconds: 9000,
        tagSummaries: [{
          tagId: 7, tagName: '공부', parentTagName: '', totalSeconds: 9000, sessionCount: 1,
          sessions: [{
            startTime: new Date(2026, 8, 1, 23, 0, 0).toISOString(),
            endTime: new Date(2026, 8, 2, 1, 30, 0).toISOString(),
            durationSeconds: 9000,
          }],
        }],
      },
    })

    renderLogs()

    await waitFor(() => expect(screen.getByText('(+1)')).toBeTruthy())
  })

  it('같은 날에 끝난 세션에는 꼬리표를 붙이지 않는다', async () => {
    get.mockResolvedValue({
      data: {
        totalSeconds: 3600,
        tagSummaries: [{
          tagId: 7, tagName: '공부', parentTagName: '', totalSeconds: 3600, sessionCount: 1,
          sessions: [{
            startTime: new Date(2026, 8, 1, 13, 0, 0).toISOString(),
            endTime: new Date(2026, 8, 1, 14, 0, 0).toISOString(),
            durationSeconds: 3600,
          }],
        }],
      },
    })

    renderLogs()

    await waitFor(() => expect(screen.getByText('세션')).toBeTruthy())
    expect(screen.queryByText(/^\(\+\d+\)$/)).toBeNull()
  })
})
