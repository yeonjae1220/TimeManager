import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

/**
 * 초점은 **조회 실패 문구의 수명** 하나다.
 *
 * 이 화면은 실패를 번역된 문자열이 아니라 메시지 키로 들고 있다가 렌더 시점에 번역한다.
 * 번역된 문자열을 state 에 넣으면 fetchRecords 가 `t` 를 붙잡게 되고, `t` 는 언어가 바뀔 때
 * identity 가 바뀌므로 **언어 전환이 곧 재조회**가 된다(스피너가 한 번 더 뜬다). 반대로
 * 키로 들고 있으면 재조회 없이 문구만 새 언어로 다시 그려진다.
 *
 * 둘 다 타입체크·빌드·린트를 통과하고 화면도 "에러 문구가 보인다"까지는 똑같아서,
 * 되돌아가도 아무 데서도 안 걸린다 — 그래서 재조회 횟수를 직접 센다.
 */

// vi.mock 팩토리는 파일 최상단으로 호이스팅되므로 목 함수도 함께 끌어올려야 한다.
const { get, router, writeRecord, navigation } = vi.hoisted(() => ({ get: vi.fn(), router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() }, writeRecord: vi.fn(), navigation: { search: '' } }))
vi.mock('@/utils/apiClient', () => ({
  default: { get, delete: vi.fn(), post: vi.fn(), put: vi.fn() },
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '10' }),
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(navigation.search),
}))
vi.mock('@/hooks/useDailyResetHour', () => ({ useDailyResetHour: () => ({ timezone: 'Asia/Seoul', resetHour: 5 }) }))
vi.mock('@/utils/recordMutations', () => ({ writeRecord }))
vi.mock('@/components/TagPickerModal', () => ({ default: ({ onSelect }: { onSelect: (id: number) => void }) => <button onClick={() => onSelect(20)}>choose destination tag</button> }))

vi.mock('@/components/layout/AppShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/store/tagStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/tagStore')>()
  const state = { tagTree: [], loadTags: vi.fn(), findById: (id: number) => ({ id, name: id === 10 ? 'Source tag' : 'Destination tag' }) }
  return {
    ...actual,
    useTagStore: (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state),
  }
})

import { I18nProvider, useI18n } from '@/i18n/I18nProvider'
import { LANG_KEY } from '@/i18n/messages/index'
import RecordListView from './RecordListView'

/** 테스트에서 언어를 바꾸기 위한 통로. 화면에는 아무것도 그리지 않는다. */
let setLanguage: (lang: string) => void = () => {}
function LanguageHandle() {
  setLanguage = useI18n().setLanguage
  return null
}

function renderView() {
  return render(
    <I18nProvider initialLanguage="ko">
      <LanguageHandle />
      <RecordListView />
    </I18nProvider>,
  )
}

beforeEach(() => {
  navigation.search = ''
  router.push.mockClear()
  router.replace.mockClear()
  writeRecord.mockReset().mockResolvedValue('saved')
  get.mockReset()
  get.mockRejectedValue(new Error('network down'))
  localStorage.setItem(LANG_KEY, 'ko')
})

function serveRecords() {
  get.mockImplementation(async (url: string) => ({ data: url.includes('/records?')
    ? [{ id: 30, totalTime: 3600, startTime: '2026-10-01T00:00Z', endTime: '2026-10-01T01:00Z' }]
    : { id: 10, name: 'Source tag' } }))
}

describe('RecordListView save destination', () => {
  it.each(['add', 'edit'])('opens the destination tag only after a successful %s', async (mode) => {
    serveRecords()
    renderView()
    await screen.findByRole('heading', { name: 'Source tag' })
    fireEvent.click(screen.getByRole('button', { name: mode === 'add' ? '추가' : '세션 편집' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Source tag' }))
    fireEvent.click(screen.getByText('choose destination tag'))
    fireEvent.click(within(dialog).getByRole('button', { name: mode === 'add' ? '추가' : '저장' }))
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/records/20?saved=1'))
    expect(writeRecord).toHaveBeenCalled()
  })

  it('announces a save on arrival and removes the one-use URL flag', async () => {
    serveRecords()
    navigation.search = 'saved=1'
    renderView()
    expect(await screen.findByRole('status')).toHaveProperty('textContent', '기록을 저장했습니다.')
    expect(router.replace).toHaveBeenCalledWith('/records/10', { scroll: false })
  })

  it('keeps the current list for same-tag saves and labels the existing row controls', async () => {
    serveRecords()
    renderView()
    await screen.findByRole('button', { name: '세션 편집' })
    expect(screen.getByRole('button', { name: '삭제' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '추가' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '추가' }))
    await screen.findByRole('status')
    expect(router.push).not.toHaveBeenCalled()
  })

  it('keeps a failed save editable without navigating or showing success', async () => {
    serveRecords()
    writeRecord.mockRejectedValue(new Error('write failed'))
    renderView()
    await screen.findByRole('heading', { name: 'Source tag' })
    fireEvent.click(screen.getByRole('button', { name: '추가' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '추가' }))
    await screen.findByText('저장을 확인하지 못했습니다. 연결과 기록 목록을 확인한 후 다시 시도해 주세요.')
    expect(router.push).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).toBeNull()
    expect((screen.getByLabelText('시작') as HTMLInputElement).disabled).toBe(false)
  })
})

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('RecordListView 조회 실패 문구', () => {
  it('실패하면 현재 언어로 문구를 보여준다', async () => {
    renderView()
    expect(await screen.findByText('기록을 불러오지 못했습니다.')).toBeTruthy()
  })

  it('언어를 바꾸면 재조회 없이 문구만 새 언어로 바뀐다', async () => {
    renderView()
    await screen.findByText('기록을 불러오지 못했습니다.')

    // 태그 1건 + 기록 1건 = 최초 조회 2회. 이 값이 늘어나면 재조회가 걸린 것이다.
    const callsAfterFirstLoad = get.mock.calls.length
    expect(callsAfterFirstLoad).toBeGreaterThan(0)

    await act(async () => { setLanguage('en') })

    await waitFor(() => expect(screen.getByText('Failed to load records.')).toBeTruthy())
    expect(screen.queryByText('기록을 불러오지 못했습니다.')).toBeNull()
    expect(get.mock.calls.length, '언어 전환이 재조회를 일으켰습니다').toBe(callsAfterFirstLoad)
  })
})
