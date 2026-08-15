import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

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

import apiClient from '@/utils/apiClient'
import { I18nProvider } from '@/i18n/I18nProvider'
import { LANG_KEY } from '@/i18n/messages/index'
import LogsView from './LogsView'

const get = apiClient.get as unknown as ReturnType<typeof vi.fn>

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
})

afterEach(() => {
  cleanup()
  localStorage.clear()
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

describe('LogsView — 태그별 탭', () => {
  /** 태그별 탭으로 이동해 태그 하나를 고른다. 이걸 해야 조회가 시작된다. */
  function selectTag() {
    fireEvent.click(screen.getByRole('button', { name: '태그별' }))
    fireEvent.click(screen.getByRole('button', { name: /태그를 선택하세요/ }))
    fireEvent.click(screen.getByRole('button', { name: '피커에서 태그 고르기' }))
  }

  it('태그를 고르기 전에는 조회하지 않고 스피너도 돌지 않는다', () => {
    get.mockResolvedValue(EMPTY_SUMMARY)

    renderLogs()
    fireEvent.click(screen.getByRole('button', { name: '태그별' }))

    // loader 가 null 인 구간. loading 이 true 로 남으면 아무것도 안 골랐는데
    // 스피너가 영원히 도는 화면이 된다.
    expect(screen.getByText('태그를 선택하면 통계가 표시됩니다')).toBeTruthy()
    expect(document.querySelector('.spinner')).toBeNull()
  })

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
})
