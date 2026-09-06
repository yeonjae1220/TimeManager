import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'

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
const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/utils/apiClient', () => ({
  default: { get, delete: vi.fn(), post: vi.fn(), put: vi.fn() },
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '10' }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

vi.mock('@/components/layout/AppShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/store/tagStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/tagStore')>()
  const state = { tagTree: [], loadTags: vi.fn() }
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
  get.mockReset()
  get.mockRejectedValue(new Error('network down'))
  localStorage.setItem(LANG_KEY, 'ko')
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
